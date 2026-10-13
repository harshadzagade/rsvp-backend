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

const content = fs.readFileSync('D:/RSVP/RSVP-Event.csv', 'utf8');
const rows = parseCSV(content);

for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const id = r[0];
  const title = r[1];
  const slug = r[2];
  const dateStr = r[3];
  const venue = r[4];
  const feeStr = r[5];
  
  const feeOptionsStr = r[r.length - 1];
  const updatedAtStr = r[r.length - 2];
  const createdAtStr = r[r.length - 3];
  const formFieldsStr = r.slice(6, r.length - 3).join(',');

  console.log(`Event ${id}: title="${title.slice(0, 25)}" createdAt="${createdAtStr}" feeOptions="${feeOptionsStr.slice(0, 20)}"`);
}
