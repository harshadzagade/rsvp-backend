const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { generateTxnId, generatePayUForm } = require('../utils/payu');
const { sendThankYouEmail, sendFailureEmail, sendAdminNotificationEmail } = require('../utils/email');
const { logPayment } = require('../utils/logger');

const prisma = new PrismaClient();

const PAYU_KEY = process.env.PAYU_KEY;
const PAYU_SALT = process.env.PAYU_SALT;
const BASE_URL = process.env.BASE_URL;

function verifyPayUHash({ key, txnid, amount, productinfo, firstname, email, status, salt, receivedHash }) {
  const hashSequence = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  const calculatedHash = crypto.createHash('sha512').update(hashSequence).digest('hex');
  return calculatedHash === receivedHash;
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

exports.registerRSVP = async (req, res) => {
  try {
    const { eventId, fullName, email, mobile, formData } = req.body;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

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

      await prisma.payment.create({
        data: {
          txnid,
          amount: 0,
          status: 'free',
          payuResponse: {},
        },
      });

      await sendThankYouEmail({
        to: email,
        name: fullName,
        eventTitle: event.title,
        eventDate: event.date,
        venue: event.venue,
        amount: 0,
        txnid,
        formData: normalizedFormData,
      });

      await sendAdminNotificationEmail({
        eventTitle: event.title,
        eventDate: event.date,
        venue: event.venue,
        amount: 0,
        txnid,
        formData: normalizedFormData,
        status: 'registered',
      });

      return sendBrowserRedirect(res, `${BASE_URL}/thank-you?free=true`);
    }

    const formHtml = generatePayUForm({
      key: PAYU_KEY,
      salt: PAYU_SALT,
      txnid,
      amount,
      firstname: fullName,
      email,
      mobile,
      productinfo: event.title,
      success_url: `${BASE_URL}/api/rsvp/success`,
      failure_url: `${BASE_URL}/api/rsvp/failure`,
    });

    res.send(formHtml);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'RSVP registration failed' });
  }
};

exports.handlePayUSuccess = async (req, res) => {
  try {
    const { txnid, status, amount, email, firstname, productinfo, hash } = req.body;

    const isValid = verifyPayUHash({
      key: process.env.PAYU_KEY,
      salt: process.env.PAYU_SALT,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      receivedHash: hash,
    });

    if (!isValid) {
      return res.status(400).send('Hash mismatch. Potential fraud.');
    }

    await prisma.rSVP.update({
      where: { txnid },
      data: { status: 'success' },
    });

    await prisma.payment.create({
      data: {
        txnid,
        amount: parseInt(amount),
        status,
        payuResponse: req.body,
      },
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

    const rsvp = await prisma.rSVP.findUnique({
      where: { txnid },
      include: { event: true },
    });

    await sendThankYouEmail({
      to: email,
      name: firstname,
      eventTitle: productinfo,
      eventDate: rsvp?.event?.date,
      venue: rsvp?.event?.venue,
      amount,
      txnid,
      formData: rsvp?.formData || {},
    });

    await sendAdminNotificationEmail({
      eventTitle: productinfo,
      eventDate: rsvp?.event?.date,
      venue: rsvp?.event?.venue,
      amount,
      txnid,
      formData: rsvp?.formData || {},
      status: 'success',
    });

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

    await prisma.payment.create({
      data: {
        txnid,
        amount: parseInt(amount),
        status,
        payuResponse: req.body,
      },
    });

    const rsvp = await prisma.rSVP.findUnique({
      where: { txnid },
      include: { event: true },
    });

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

    if (rsvp) {
      const failureFormData = {
        ...rsvp.formData,
        txnid,
      };

      await sendFailureEmail({
        to: rsvp.email,
        name: rsvp.fullName,
        eventTitle: rsvp.event?.title || 'Event',
        eventDate: rsvp.event?.date,
        venue: rsvp.event?.venue,
        formData: failureFormData,
      });

      await sendAdminNotificationEmail({
        eventTitle: rsvp.event?.title || 'Event',
        eventDate: rsvp.event?.date,
        venue: rsvp.event?.venue,
        amount,
        txnid,
        formData: failureFormData,
        status: 'failed',
      });
    }

    return sendBrowserRedirect(res, `${BASE_URL}/payment-failed?error=declined`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};
