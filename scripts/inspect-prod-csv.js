const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to parse standard CSV line with quoted values
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
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal);
      currentVal = '';
      if (currentRow.some(c => c.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    if (currentRow.some(c => c.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Clean Python/Postgres single quotes into valid JSON
function parseJsonField(val) {
  if (!val || val.trim() === '') return [];
  try {
    return JSON.parse(val);
  } catch (e1) {
    try {
      // Fix Python style quotes: {'"name'": ...}
      let cleaned = val
        .replace(/'"/g, '"')
        .replace(/"'/g, '"')
        .replace(/'/g, '"');
      return JSON.parse(cleaned);
    } catch (e2) {
      return val;
    }
  }
}

async function run() {
  console.log('--- Checking Production CSV Files ---');

  const baseDir = path.resolve('D:/RSVP');
  const userFile = path.join(baseDir, 'RSVP-User.csv');
  const eventFile = path.join(baseDir, 'RSVP-Event.csv');
  const rsvpFile = path.join(baseDir, 'RSVP-RSVP.csv');
  const paymentFile = path.join(baseDir, 'RSVP-Payment.csv');

  console.log('Found CSVs:');
  console.log(' - User:', fs.existsSync(userFile));
  console.log(' - Event:', fs.existsSync(eventFile));
  console.log(' - RSVP:', fs.existsSync(rsvpFile));
  console.log(' - Payment:', fs.existsSync(paymentFile));

  const eventsData = parseCSV(fs.readFileSync(eventFile, 'utf8'));
  const rsvpsData = parseCSV(fs.readFileSync(rsvpFile, 'utf8'));
  const paymentsData = parseCSV(fs.readFileSync(paymentFile, 'utf8'));
  const usersData = parseCSV(fs.readFileSync(userFile, 'utf8'));

  console.log(`\nRecords in CSV:`);
  console.log(` - Users: ${usersData.length - 1}`);
  console.log(` - Events: ${eventsData.length - 1}`);
  console.log(` - RSVPs: ${rsvpsData.length - 1}`);
  console.log(` - Payments: ${paymentsData.length - 1}`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
