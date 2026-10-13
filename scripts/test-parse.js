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
      // Handle Python dict string representation:
      // e.g. {'"name"': '"val"'} or {'key': 'val'}
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

const lines = fs.readFileSync('D:/RSVP/RSVP-RSVP.csv', 'utf8').split('\n');
console.log('Total RSVP lines:', lines.length);
const row1 = parseCSVLine(lines[1]);
console.log('Row 1 columns count:', row1.length);
console.log('Row 1 ID:', row1[0], 'Name:', row1[2], 'TxnId:', row1[6]);
const parsedJson = cleanJson(row1[5]);
console.log('Parsed JSON from formData:', parsedJson);
