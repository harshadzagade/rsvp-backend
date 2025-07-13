const fs = require('fs-extra');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
fs.ensureDirSync(logDir); // make sure logs folder exists

function logPayment(data, type = 'transaction') {
  const logPath = path.join(logDir, `${type}.log`);
  const logEntry = `[${new Date().toISOString()}] ${JSON.stringify(data)}\n`;
  fs.appendFileSync(logPath, logEntry);
}

module.exports = { logPayment };
