const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { generateTxnId, generatePayUForm } = require('../utils/payu');
const { sendThankYouEmail, sendFailureEmail } = require('../utils/email');
const { logPayment } = require('../utils/logger');


const prisma = new PrismaClient();

const PAYU_KEY = process.env.PAYU_KEY;
const PAYU_SALT = process.env.PAYU_SALT;

const BASE_URL = process.env.BASE_URL;

// Hash verification
function verifyPayUHash({ key, txnid, amount, productinfo, firstname, email, status, salt, receivedHash }) {
  const hashSequence = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  const calculatedHash = crypto.createHash('sha512').update(hashSequence).digest('hex');
  return calculatedHash === receivedHash;
}

exports.registerRSVP = async (req, res) => {
  try {
    const { eventId, fullName, email, mobile, formData } = req.body;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const txnid = generateTxnId();
    let amount = event.fee; // fallback
    let matchedCurrency = 'INR';
    let matchedRule = null;

    const options = event.feeOptions?.options || [];

    for (const rule of options) {
      const logic = rule.logic || 'AND';
      const conditions = rule.conditions || [];

      const matches = conditions.map(cond => {
        return (formData[cond.field] || '').toLowerCase() === (cond.value || '').toLowerCase();
      });

      const isMatch = logic === 'AND' ? matches.every(Boolean) : matches.some(Boolean);

      if (isMatch) {
        amount = rule.fee;
        matchedCurrency = rule.currency || 'INR';
        matchedRule = rule; // ✅ Capture matched rule here
        break;
      }
    }

    const rsvp = await prisma.rSVP.create({
      data: {
        eventId,
        fullName,
        email,
        mobile,
        txnid,
        formData
      }
    });

    // 🆕 ✅ Handle FREE event registration (fee === 0)
    if (amount === 0) {
      await prisma.rSVP.update({
        where: { txnid },
        data: { status: 'success' }
      });

      await prisma.payment.create({
        data: {
          txnid,
          amount: 0,
          status: 'free',
          payuResponse: {}
        }
      });

      await sendThankYouEmail({
        to: email,
        name: fullName,
        eventTitle: event.title,
        amount: 0,
        txnid,
        matchedRule
      });

      return res.redirect(`${BASE_URL}/thank-you?free=true`);
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
      failure_url: `${BASE_URL}/api/rsvp/failure`
    });

    res.send(formHtml);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'RSVP registration failed' });
  }
};

exports.handlePayUSuccess = async (req, res) => {
  try {
    const {
      txnid,
      status,
      amount,
      email,
      firstname,
      productinfo,
      hash
    } = req.body;

    const isValid = verifyPayUHash({
      key: process.env.PAYU_KEY,
      salt: process.env.PAYU_SALT,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      receivedHash: hash
    });



    if (!isValid) {
      return res.status(400).send('Hash mismatch. Potential fraud.');
    }

    // Update RSVP and Payment
    await prisma.rSVP.update({
      where: { txnid },
      data: { status: 'success' }
    });

    await prisma.payment.create({
      data: {
        txnid,
        amount: parseInt(amount),
        status,
        payuResponse: req.body
      }
    });

    // ✅ 3. LOG PAYMENT SUCCESS HERE
    const { logPayment } = require('../utils/logger');
    logPayment({
      status: 'success',
      txnid,
      amount,
      user: {
        name: firstname,
        email
      },
      eventTitle: productinfo,
      gatewayStatus: status,
      timestamp: new Date().toISOString(),
      raw: req.body
    });


    await sendThankYouEmail({
      to: email,
      name: firstname,
      eventTitle: productinfo,
      amount,
      txnid,
      matchedRule
    });


    res.redirect(`${BASE_URL}/thank-you`);

    // ✅ Optional fallback: HTML-based redirect
    // res.send(`
    //   <html>
    //     <head><meta http-equiv="refresh" content="0; URL='${BASE_URL}/thank-you'" /></head>
    //     <body>Redirecting to confirmation page...</body>
    //   </html>
    // `);


  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

exports.handlePayUFailure = async (req, res) => {
  try {
    const {
      txnid,
      status,
      amount
    } = req.body;

    await prisma.rSVP.update({
      where: { txnid },
      data: { status: 'failed' }
    });

    await prisma.payment.create({
      data: {
        txnid,
        amount: parseInt(amount),
        status,
        payuResponse: req.body
      }
    });


    const rsvp = await prisma.rSVP.findUnique({
      where: { txnid },
      include: { event: true }
    });

    logPayment({
      status: 'failed',
      txnid,
      amount,
      user: {
        name: rsvp?.fullName,
        email: rsvp?.email
      },
      eventTitle: rsvp?.event?.title,
      reason: 'Payment gateway marked as failed',
      gatewayStatus: status,
      timestamp: new Date().toISOString(),
      raw: req.body
    });

    if (rsvp) {
      await sendFailureEmail({
        to: rsvp.email,
        name: rsvp.fullName,
        eventTitle: rsvp.event?.title || 'Event'
      });
    }


    res.redirect(`${BASE_URL}/payment-failed?error=declined`);


    // ✅ Optional fallback: HTML
    // res.send(`
    //   <html>
    //     <head><meta http-equiv="refresh" content="0; URL='${BASE_URL}/payment-failed'" /></head>
    //     <body>Redirecting to failure page...</body>
    //   </html>
    // `);

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};