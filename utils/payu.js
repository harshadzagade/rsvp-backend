const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

function generateTxnId() {
  return 'TXN' + Date.now() + Math.floor(Math.random() * 1000);
}

function generatePayUHash({ key, salt, txnid, amount, productinfo, firstname, email }) {
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

function generatePayUForm({
  key, salt, txnid, amount, firstname, email, mobile, productinfo, success_url, failure_url
}) {
  const hash = generatePayUHash({ key, salt, txnid, amount, productinfo, firstname, email });

  return `
    <html>
      <body onload="document.forms[0].submit()">
        <form method="post" action="${process.env.PAYU_BASE_URL}">
          <input type="hidden" name="key" value="${key}" />
          <input type="hidden" name="txnid" value="${txnid}" />
          <input type="hidden" name="amount" value="${amount}" />
          <input type="hidden" name="productinfo" value="${productinfo}" />
          <input type="hidden" name="firstname" value="${firstname}" />
          <input type="hidden" name="email" value="${email}" />
          <input type="hidden" name="phone" value="${mobile}" />
          <input type="hidden" name="surl" value="${success_url}" />
          <input type="hidden" name="furl" value="${failure_url}" />
          <input type="hidden" name="hash" value="${hash}" />
        </form>
      </body>
    </html>
  `;
}

function generateVerifyPaymentHash({ key, salt, txnid }) {
  const hashString = `${key}|verify_payment|${txnid}|${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

function getVerifyPaymentUrl() {
  if (process.env.PAYU_VERIFY_URL) return process.env.PAYU_VERIFY_URL;

  if ((process.env.PAYU_BASE_URL || '').includes('secure.payu.in')) {
    return 'https://info.payu.in/merchant/postservice.php?form=2';
  }

  return 'https://test.payu.in/merchant/postservice.php?form=2';
}

async function verifyPaymentWithPayU({ key, salt, txnid }) {
  const hash = generateVerifyPaymentHash({ key, salt, txnid });
  const payload = new URLSearchParams({
    key,
    command: 'verify_payment',
    var1: txnid,
    hash,
  });

  const response = await fetch(getVerifyPaymentUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Unable to parse PayU verify_payment response: ${text}`);
  }

  const txnDetails = data?.transaction_details?.[txnid] || data?.result?.[0] || data?.result?.[txnid] || null;
  const verifiedStatus = txnDetails?.status || txnDetails?.unmappedstatus || data?.status || null;

  return {
    raw: data,
    txnDetails,
    verifiedStatus: String(verifiedStatus || '').toLowerCase(),
  };
}

module.exports = {
  generateTxnId,
  generatePayUHash,
  generatePayUForm,
  verifyPaymentWithPayU,
};
