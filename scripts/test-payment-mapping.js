const fs = require('fs');

function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentVal);
      currentVal = '';
      if (currentRow.some(c => c.trim() !== '')) rows.push(currentRow);
      currentRow = [];
    } else {
      currentVal += char;
    }
  }
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    if (currentRow.some(c => c.trim() !== '')) rows.push(currentRow);
  }
  return rows;
}

const content = fs.readFileSync('D:/RSVP/RSVP-Payment.csv', 'utf8');
const rows = parseCSV(content);

let validCount = 0;
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const id = parseInt(r[0]);
  const txnid = r[1];
  const amount = parseInt(r[2]);
  const status = r[3];
  const createdAtStr = r[r.length - 1];
  const payuResponseStr = r.slice(4, r.length - 1).join(',');

  if (id && txnid) {
    validCount++;
  }
}
console.log(`Validated Payments count: ${validCount} / ${rows.length - 1}`);
