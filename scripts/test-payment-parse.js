const fs = require('fs');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function cleanJson(val) {
  if (!val) return {};
  val = val.trim();
  try {
    return JSON.parse(val);
  } catch (e) {
    try {
      let fixed = val
        .replace(/'"/g, '"')
        .replace(/"'/g, '"')
        .replace(/'/g, '"');
      return JSON.parse(fixed);
    } catch (e2) {
      return { raw: val };
    }
  }
}

const lines = fs.readFileSync('D:/RSVP/RSVP-Payment.csv', 'utf8').split('\n');
console.log('Total Payment lines:', lines.length);
const row1 = parseCSVLine(lines[1]);
console.log('Payment Row 1 columns count:', row1.length);
console.log('Payment ID:', row1[0], 'TxnId:', row1[1], 'Amount:', row1[2], 'Status:', row1[3]);
const payuResp = cleanJson(row1[4]);
console.log('PayU response keys:', Object.keys(payuResp).slice(0, 5));
