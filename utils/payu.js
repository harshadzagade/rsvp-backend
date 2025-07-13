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
  const hash = generatePayUHash({ key, salt, txnid, amount, productinfo, firstname, email, mobile });

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

module.exports = {
  generateTxnId,
  generatePayUHash,
  generatePayUForm
};
