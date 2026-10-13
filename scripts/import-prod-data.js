const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

function cleanJson(val) {
  if (!val || val.trim() === '') return {};
  val = val.trim();
  try {
    return JSON.parse(val);
  } catch (e1) {
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

function safeDate(val) {
  if (!val) return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function inferInstitute(title = '', slug = '', venue = '') {
  const sSlug = (slug || '').toLowerCase();
  const sTitle = (title || '').toLowerCase();
  const sVenue = (venue || '').toLowerCase();

  if (sSlug.includes('iop') || sSlug.includes('pharmacy') || sTitle.includes('iop') || sTitle.includes('pharmacy') || sVenue.includes('iop')) {
    return 'IOP';
  }
  if (sSlug.includes('pgdm') || sTitle.includes('pgdm') || sVenue.includes('pgdm')) {
    return 'PGDM';
  }
  if (sSlug.includes('imm') || sTitle.includes('imm') || sVenue.includes('imm') || sTitle.includes('mass media') || sSlug.includes('sfx')) {
    return 'IMM';
  }
  if (sSlug.includes('ics') || sSlug.includes('cism') || sSlug.includes('icetcism') || /\bics\b/i.test(sTitle)) {
    return 'ICS';
  }
  return 'IMM';
}

async function importData() {
  console.log('🚀 Starting Exact Production CSV Import...');
  const baseDir = path.resolve('D:/RSVP');

  // 1. IMPORT USERS
  console.log('\n--- 1. Importing Users ---');
  const userRows = parseCSV(fs.readFileSync(path.join(baseDir, 'RSVP-User.csv'), 'utf8'));
  let userCount = 0;
  for (let i = 1; i < userRows.length; i++) {
    const row = userRows[i];
    if (!row || row.length < 5) continue;
    const [idStr, name, email, password, role, inst, createdAtStr] = row;
    const id = parseInt(idStr);
    if (!email) continue;

    const emailLower = email.toLowerCase();
    let assignedInst = inst ? inst.trim() : null;
    if (!assignedInst) {
      if (emailLower.includes('_imm@')) assignedInst = 'IMM';
      else if (emailLower.includes('_ics@')) assignedInst = 'ICS';
      else if (emailLower.includes('_iop@')) assignedInst = 'IOP';
      else if (emailLower.includes('_iit@')) assignedInst = 'IIT';
      else if (emailLower.includes('_pgdm@')) assignedInst = 'PGDM';
    }

    await prisma.user.upsert({
      where: { id },
      update: {
        name: name ? name.trim() : 'Admin',
        email: email.trim(),
        role: role.trim().toUpperCase(),
        institute: assignedInst,
        password: password.trim(),
      },
      create: {
        id,
        name: name ? name.trim() : 'Admin',
        email: email.trim(),
        password: password.trim(),
        role: role.trim().toUpperCase(),
        institute: assignedInst,
        createdAt: safeDate(createdAtStr),
      }
    });
    userCount++;
  }
  console.log(`✅ Users Processed: ${userCount}`);

  // 2. IMPORT EVENTS
  console.log('\n--- 2. Importing Events ---');
  const eventRows = parseCSV(fs.readFileSync(path.join(baseDir, 'RSVP-Event.csv'), 'utf8'));
  let eventCount = 0;
  for (let i = 1; i < eventRows.length; i++) {
    const row = eventRows[i];
    if (!row || row.length < 6) continue;
    const id = parseInt(row[0]);
    const title = row[1];
    const slug = row[2];
    const dateStr = row[3];
    const venue = row[4];
    const feeStr = row[5];
    
    const feeOptionsStr = row[row.length - 1];
    const updatedAtStr = row[row.length - 2];
    const createdAtStr = row[row.length - 3];
    const formFieldsStr = row.slice(6, row.length - 3).join(',');

    if (!id || !title) continue;

    const fee = parseInt(feeStr) || 0;
    const formFields = cleanJson(formFieldsStr);
    const feeOptions = feeOptionsStr ? cleanJson(feeOptionsStr) : null;
    const inst = inferInstitute(title, slug, venue);

    await prisma.event.upsert({
      where: { id },
      update: {
        title: title.trim(),
        slug: slug.trim(),
        date: safeDate(dateStr),
        venue: venue ? venue.trim() : 'MET Campus',
        fee,
        formFields: Array.isArray(formFields) ? formFields : [],
        feeOptions: typeof feeOptions === 'object' && feeOptions !== null ? feeOptions : undefined,
        institute: inst,
        isActive: true,
      },
      create: {
        id,
        title: title.trim(),
        slug: slug.trim(),
        date: safeDate(dateStr),
        venue: venue ? venue.trim() : 'MET Campus',
        fee,
        formFields: Array.isArray(formFields) ? formFields : [],
        feeOptions: typeof feeOptions === 'object' && feeOptions !== null ? feeOptions : undefined,
        institute: inst,
        isActive: true,
        createdAt: safeDate(createdAtStr),
        updatedAt: safeDate(updatedAtStr),
      }
    });
    eventCount++;
  }
  console.log(`✅ Events Processed: ${eventCount}`);

  // 3. IMPORT RSVPS
  console.log('\n--- 3. Importing RSVPs ---');
  const rsvpRows = parseCSV(fs.readFileSync(path.join(baseDir, 'RSVP-RSVP.csv'), 'utf8'));
  let rsvpCount = 0;
  for (let i = 1; i < rsvpRows.length; i++) {
    const row = rsvpRows[i];
    if (!row || row.length < 8) continue;
    const id = parseInt(row[0]);
    const eventId = parseInt(row[1]);
    const fullName = row[2];
    const email = row[3];
    const mobile = row[4];
    const createdAtStr = row[row.length - 1];
    const status = row[row.length - 2];
    const txnid = row[row.length - 3];
    const formDataStr = row.slice(5, row.length - 3).join(',');

    if (!id || !txnid) continue;

    const formData = cleanJson(formDataStr);

    try {
      await prisma.rSVP.upsert({
        where: { id },
        update: {
          eventId,
          fullName: fullName ? fullName.trim() : 'Participant',
          email: email ? email.trim() : '',
          mobile: mobile ? mobile.trim() : '',
          formData,
          txnid: txnid.trim(),
          status: status ? status.trim().toLowerCase() : 'initiated',
        },
        create: {
          id,
          eventId,
          fullName: fullName ? fullName.trim() : 'Participant',
          email: email ? email.trim() : '',
          mobile: mobile ? mobile.trim() : '',
          formData,
          txnid: txnid.trim(),
          status: status ? status.trim().toLowerCase() : 'initiated',
          createdAt: safeDate(createdAtStr),
        }
      });
      rsvpCount++;
    } catch (err) {
      console.error(`Error importing RSVP id ${id}:`, err.message);
    }
  }
  console.log(`✅ RSVPs Processed: ${rsvpCount}`);

  // 4. IMPORT PAYMENTS
  console.log('\n--- 4. Importing Payments ---');
  const paymentRows = parseCSV(fs.readFileSync(path.join(baseDir, 'RSVP-Payment.csv'), 'utf8'));
  let paymentCount = 0;
  for (let i = 1; i < paymentRows.length; i++) {
    const row = paymentRows[i];
    if (!row || row.length < 5) continue;
    const id = parseInt(row[0]);
    const txnid = row[1];
    const amount = parseInt(row[2]) || 0;
    const status = row[3];
    const createdAtStr = row[row.length - 1];
    const payuResponseStr = row.slice(4, row.length - 1).join(',');

    if (!id || !txnid) continue;

    const payuResponse = cleanJson(payuResponseStr);

    // Ensure RSVP exists for this txnid
    const rsvpExists = await prisma.rSVP.findUnique({ where: { txnid: txnid.trim() } });
    if (!rsvpExists) {
      continue;
    }

    try {
      await prisma.payment.upsert({
        where: { id },
        update: {
          txnid: txnid.trim(),
          amount,
          status: status ? status.trim().toLowerCase() : 'success',
          payuResponse,
        },
        create: {
          id,
          txnid: txnid.trim(),
          amount,
          status: status ? status.trim().toLowerCase() : 'success',
          payuResponse,
          createdAt: safeDate(createdAtStr),
        }
      });
      paymentCount++;
    } catch (err) {
      console.error(`Error importing Payment id ${id}:`, err.message);
    }
  }
  console.log(`✅ Payments Processed: ${paymentCount}`);

  // 5. RESET POSTGRES AUTO-INCREMENT SEQUENCES
  console.log('\n--- 5. Resetting Database Auto-increment Sequences ---');
  try {
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), coalesce(max(id), 1)) FROM "User";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Event"', 'id'), coalesce(max(id), 1)) FROM "Event";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"RSVP"', 'id'), coalesce(max(id), 1)) FROM "RSVP";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Payment"', 'id'), coalesce(max(id), 1)) FROM "Payment";`);
    console.log('✅ PostgreSQL Sequences Reset to MAX(id)');
  } catch (seqErr) {
    console.warn('Sequence reset warning:', seqErr.message);
  }

  // 6. FINAL COUNT VERIFICATION
  const totalUsers = await prisma.user.count();
  const totalEvents = await prisma.event.count();
  const totalRsvps = await prisma.rSVP.count();
  const totalPayments = await prisma.payment.count();

  console.log('\n=======================================');
  console.log('🎉 Production Data Import Complete!');
  console.log(`👥 Total Users in DB:    ${totalUsers}`);
  console.log(`📅 Total Events in DB:   ${totalEvents}`);
  console.log(`📝 Total RSVPs in DB:    ${totalRsvps}`);
  console.log(`💳 Total Payments in DB: ${totalPayments}`);
  console.log('=======================================');
}

importData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
