const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { generateTxnId, generatePayUForm, verifyPaymentWithPayU } = require('../utils/payu');
const { sendThankYouEmail, sendFailureEmail, sendAdminNotificationEmail } = require('../utils/email');
const { logPayment } = require('../utils/logger');
const { getCredentialsForEvent } = require('../utils/config');

const prisma = new PrismaClient();

const BASE_URL = process.env.BASE_URL;

function verifyPayUHash({
  key,
  txnid,
  amount,
  productinfo,
  firstname,
  email,
  status,
  salt,
  receivedHash,
  udf1 = '',
  udf2 = '',
  udf3 = '',
  udf4 = '',
  udf5 = '',
  additionalCharges = '',
}) {
  const reverseHashParts = [
    salt,
    status,
    '', // udf10
    '', // udf9
    '', // udf8
    '', // udf7
    '', // udf6
    udf5,
    udf4,
    udf3,
    udf2,
    udf1,
    email,
    firstname,
    productinfo,
    amount,
    txnid,
    key,
  ];

  const hashSequence = additionalCharges
    ? [additionalCharges, ...reverseHashParts].join('|')
    : reverseHashParts.join('|');

  const calculatedHash = crypto.createHash('sha512').update(hashSequence).digest('hex');
  return calculatedHash === String(receivedHash || '').toLowerCase();
}

function sendBrowserRedirect(res, destination) {
  return res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="0; URL='${destination}'" />
        <script>window.location.replace(${JSON.stringify(destination)});</script>
      </head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        Redirecting to <a href="${destination}">${destination}</a>...
      </body>
    </html>
  `);
}

async function runEmailTasks(tasks) {
  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('Email task failed:', result.reason);
    }
  });
}

async function upsertPayment({ txnid, amount, status, payuResponse }) {
  return prisma.payment.upsert({
    where: { txnid },
    update: {
      amount,
      status,
      payuResponse,
    },
    create: {
      txnid,
      amount,
      status,
      payuResponse,
    },
  });
}

exports.registerRSVP = async (req, res) => {
  try {
    const { eventId, fullName, email, mobile, formData } = req.body;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const credentials = getCredentialsForEvent(event);
    if (!credentials) {
      console.error('RSVP attempted for unconfigured event:', { eventId, slug: event.slug });
      return res.status(400).send(`
        <html>
          <body style="font-family: 'Segoe UI', Arial, sans-serif; text-align: center; padding: 50px; background: #fafafa; color: #333;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
              <h2 style="color: #DC2626; margin-top: 0;">Configuration Error</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #4B5563;">This event's payment gateway or registration configuration has not been set up yet.</p>
              <hr style="margin: 20px 0; border: 0; border-top: 1px solid #e5e7eb;" />
              <p style="font-size: 14px; color: #6B7280;">Please contact the system administrator at <a href="mailto:principal_ics@met.edu" style="color: #2563EB; text-decoration: none;">principal_ics@met.edu</a> for assistance.</p>
            </div>
          </body>
        </html>
      `);
    }

    const txnid = generateTxnId();
    let amount = event.fee;

    const normalizedFormData = {
      ...formData,
      fullName,
      email,
      mobile,
    };

    const options = event.feeOptions?.options || [];

    for (const rule of options) {
      const logic = rule.logic || 'AND';
      const conditions = rule.conditions || [];

      const matches = conditions.map((cond) => {
        return (normalizedFormData[cond.field] || '').toLowerCase() === (cond.value || '').toLowerCase();
      });

      const isMatch = logic === 'AND' ? matches.every(Boolean) : matches.some(Boolean);

      if (isMatch) {
        amount = rule.fee;
        break;
      }
    }

    await prisma.rSVP.create({
      data: {
        eventId,
        fullName,
        email,
        mobile,
        txnid,
        formData: normalizedFormData,
      },
    });

    if (amount === 0) {
      await prisma.rSVP.update({
        where: { txnid },
        data: { status: 'success' },
      });

      await upsertPayment({
        txnid,
        amount: 0,
        status: 'free',
        payuResponse: {},
      });

      await runEmailTasks([
        sendThankYouEmail({
          to: email,
          name: fullName,
          eventTitle: event.title,
          eventDate: event.date,
          venue: event.venue,
          amount: 0,
          txnid,
          formData: normalizedFormData,
          credentials,
        }),
        sendAdminNotificationEmail({
          eventTitle: event.title,
          eventDate: event.date,
          venue: event.venue,
          amount: 0,
          txnid,
          formData: normalizedFormData,
          status: 'registered',
          credentials,
        }),
      ]);

      return sendBrowserRedirect(res, `${BASE_URL}/thank-you?free=true`);
    }

    const formHtml = generatePayUForm({
      key: credentials.key,
      salt: credentials.salt,
      txnid,
      amount,
      firstname: fullName,
      email,
      mobile,
      productinfo: event.title,
      success_url: `${BASE_URL}/api/rsvp/success`,
      failure_url: `${BASE_URL}/api/rsvp/failure`,
      baseUrl: credentials.baseUrl,
    });

    res.send(formHtml);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'RSVP registration failed' });
  }
};

exports.handlePayUSuccess = async (req, res) => {
  try {
    const { txnid, status, amount, email, firstname, productinfo, hash, key: responseKey } = req.body;

    const rsvp = await prisma.rSVP.findUnique({
      where: { txnid },
      include: { event: true },
    });

    if (!rsvp) {
      console.error('RSVP transaction not found for success callback', { txnid });
      return res.status(404).send('Transaction not found.');
    }

    const event = rsvp.event;
    const credentials = getCredentialsForEvent(event);

    const isValid = verifyPayUHash({
      key: responseKey || credentials.key,
      salt: credentials.salt,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      receivedHash: hash,
      udf1: req.body.udf1,
      udf2: req.body.udf2,
      udf3: req.body.udf3,
      udf4: req.body.udf4,
      udf5: req.body.udf5,
      additionalCharges: req.body.additionalCharges || req.body.additional_charges,
    });

    if (String(responseKey || '') !== String(credentials.key || '')) {
      console.error('PayU key mismatch', {
        txnid,
        responseKey,
        configuredKey: credentials.key,
      });
      return res.status(400).send('Merchant key mismatch.');
    }

    if (!isValid) {
      console.error('PayU hash verification failed, attempting verify_payment fallback', {
        txnid,
        responseKey,
        configuredKey: credentials.key,
        status,
        amount,
      });

      const verification = await verifyPaymentWithPayU({
        key: credentials.key,
        salt: credentials.salt,
        txnid,
        baseUrl: credentials.baseUrl,
      });

      if (verification.verifiedStatus !== 'success') {
        console.error('verify_payment did not confirm success', {
          txnid,
          verifiedStatus: verification.verifiedStatus,
          raw: verification.raw,
        });
        return res.status(400).send('Hash mismatch. Potential fraud.');
      }
    }

    await prisma.rSVP.update({
      where: { txnid },
      data: { status: 'success' },
    });

    await upsertPayment({
      txnid,
      amount: parseInt(amount),
      status,
      payuResponse: req.body,
    });

    logPayment({
      status: 'success',
      txnid,
      amount,
      user: {
        name: firstname,
        email,
      },
      eventTitle: productinfo,
      gatewayStatus: status,
      timestamp: new Date().toISOString(),
      raw: req.body,
    });

    const recipientEmail = rsvp?.email || email;
    const recipientName = rsvp?.fullName || firstname;
    const savedFormData = rsvp?.formData || {};

    await runEmailTasks([
      sendThankYouEmail({
        to: recipientEmail,
        name: recipientName,
        eventTitle: productinfo,
        eventDate: rsvp?.event?.date,
        venue: rsvp?.event?.venue,
        amount,
        txnid,
        formData: savedFormData,
        credentials,
      }),
      sendAdminNotificationEmail({
        eventTitle: productinfo,
        eventDate: rsvp?.event?.date,
        venue: rsvp?.event?.venue,
        amount,
        txnid,
        formData: savedFormData,
        status: 'success',
        credentials,
      }),
    ]);

    return sendBrowserRedirect(res, `${BASE_URL}/thank-you`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

exports.handlePayUFailure = async (req, res) => {
  try {
    const { txnid, status, amount } = req.body;

    await prisma.rSVP.update({
      where: { txnid },
      data: { status: 'failed' },
    });

    await upsertPayment({
      txnid,
      amount: parseInt(amount),
      status,
      payuResponse: req.body,
    });

    const rsvp = await prisma.rSVP.findUnique({
      where: { txnid },
      include: { event: true },
    });

    if (rsvp) {
      const credentials = getCredentialsForEvent(rsvp.event);
      const failureFormData = {
        ...rsvp.formData,
        txnid,
      };

      logPayment({
        status: 'failed',
        txnid,
        amount,
        user: {
          name: rsvp?.fullName,
          email: rsvp?.email,
        },
        eventTitle: rsvp?.event?.title,
        reason: 'Payment gateway marked as failed',
        gatewayStatus: status,
        timestamp: new Date().toISOString(),
        raw: req.body,
      });

      await runEmailTasks([
        sendFailureEmail({
          to: rsvp.email,
          name: rsvp.fullName,
          eventTitle: rsvp.event?.title || 'Event',
          eventDate: rsvp.event?.date,
          venue: rsvp.event?.venue,
          formData: failureFormData,
          credentials,
        }),
        sendAdminNotificationEmail({
          eventTitle: rsvp.event?.title || 'Event',
          eventDate: rsvp.event?.date,
          venue: rsvp.event?.venue,
          amount,
          txnid,
          formData: failureFormData,
          status: 'failed',
          credentials,
        }),
      ]);
    }

    return sendBrowserRedirect(res, `${BASE_URL}/payment-failed?error=declined`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};
