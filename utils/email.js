const nodemailer = require('nodemailer');
const { parseEmailList } = require('./config');

const defaultTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const transporters = new Map();

function getTransporter(credentials) {
  const user = credentials?.emailUser;
  const pass = credentials?.emailPass;

  if (!user || !pass) {
    return defaultTransporter;
  }

  const cacheKey = `${user}:${pass}`;
  if (transporters.has(cacheKey)) {
    return transporters.get(cacheKey);
  }

  const dynamicTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
      user,
      pass,
    },
  });

  transporters.set(cacheKey, dynamicTransporter);
  return dynamicTransporter;
}

const ADMIN_EMAILS = [
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : []),
  ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : []),
]
  .map((email) => email.trim())
  .filter(Boolean);

const INTERNAL_AUDIT_EMAILS = ['anirudham_ics@met.edu', 'manojkumarp_iit@met.edu', 'artig_iom@met.edu'];

const formatDate = (value, credentials) => {
  const slug = String(credentials?.slug || '').toLowerCase();
  if (slug === 'iop-fdp') {
    return '6th - 10th July 2026';
  }
  if (slug === 'iop-fdp-python') {
    return '17th and 18th July 2026';
  }
  if (slug === 'iop-cosmonext') {
    return '3rd - 4th September 2026';
  }
  if (slug.includes('sfx')) {
    return '21st October 2026';
  }
  if (!value) return '26 - 27 June 2026';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const buildProgrammeSummary = ({ eventTitle, eventDate, venue, credentials }) => `
  <div style="margin: 20px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fafafa;">
    <h3 style="margin: 0 0 12px; color: #111827;">Programme Details</h3>
    <p style="margin: 6px 0;"><strong>Programme:</strong> ${eventTitle}</p>
    <p style="margin: 6px 0;"><strong>Date:</strong> ${formatDate(eventDate, credentials)}</p>
    <p style="margin: 6px 0;"><strong>Venue:</strong> ${venue || credentials?.instituteName || 'MET Institute of Computer Science'}</p>
  </div>
`;

const normalizeLabel = (key) =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const buildParticipantSummary = ({ formData = {}, amount, txnid, statusLabel }) => {
  const handledKeys = new Set([
    'fullname', 'name', 'email', 'mobile', 'whatsappnumber', 'contactnumber', 'phone',
    'category', 'participationcategory', 'participationmode', 'paymenttype',
    'organisation', 'institutename', 'nameofinstitutecollege', 'designation',
    'certificatename', 'joiningreason', 'txnid',
    'amountbreakdown', 'breakdown', 'feebreakdown', 'amount', 'fee', 'feeoptions'
  ]);

  const rows = [
    ['Name', formData.fullName || formData.FullName || formData.name || ''],
    ['Email', formData.email || formData.Email || ''],
    ['Mobile', formData.mobile || formData.Mobile || formData['WhatsApp Number'] || formData['Contact number'] || formData.contactNumber || ''],
    ['Category', formData.category || formData.ParticipationCategory || ''],
    ['Participation Mode', formData.participationMode || formData.PaymentType || ''],
    ['Organisation', formData.organisation || formData.instituteName || formData['Name of Institute/College'] || ''],
    ['Designation', formData.designation || formData.Designation || ''],
    ['Certificate Name', formData.certificateName || ''],
    ['Joining Reason', formData.joiningReason || ''],
  ];

  // Append any extra form fields dynamically (e.g. poster presentation fields)
  // Exclude objects/arrays like amountBreakdown so they never appear in the email
  Object.entries(formData).forEach(([key, value]) => {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      !handledKeys.has(cleanKey) &&
      value !== undefined &&
      value !== null &&
      value !== '' &&
      typeof value !== 'object'
    ) {
      rows.push([normalizeLabel(key), String(value)]);
    }
  });

  // Append Transaction metadata at bottom
  rows.push(['Transaction ID', txnid]);
  rows.push(['Payment Status', statusLabel]);
  rows.push(['Amount', (amount !== undefined && amount !== null && amount !== '') ? `Rs. ${Number(amount).toLocaleString('en-IN')}` : 'Not completed']);

  const filteredRows = rows.filter(([, value]) => value !== undefined && value !== null && value !== '');

  return `
    <table style="margin: 20px 0; border-collapse: collapse; width: 100%;">
      ${filteredRows.map(([label, value]) => `
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb; width: 220px; vertical-align: top;">${label}</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${value}</td>
        </tr>
      `).join('')}
    </table>
  `;
};

function replaceVariables(templateStr, data) {
  if (!templateStr) return '';
  return templateStr
    .replace(/{name}/g, data.name || 'Participant')
    .replace(/{eventName}/g, data.confName || 'Event')
    .replace(/{eventTitle}/g, data.confName || 'Event')
    .replace(/{confName}/g, data.confName || 'Event')
    .replace(/{date}/g, data.eventDate ? formatDate(data.eventDate, data.credentials) : '')
    .replace(/{venue}/g, data.venue || data.fromName || 'MET Campus')
    .replace(/{amount}/g, data.amount ? `Rs. ${Number(data.amount).toLocaleString('en-IN')}` : 'Free')
    .replace(/{txnid}/g, data.txnid || '-')
    .replace(/{instituteName}/g, data.fromName || 'MET');
}

async function sendThankYouEmail({ to, name, eventTitle, eventDate, venue, amount, txnid, formData = {}, credentials }) {
  const isFree = !amount || Number(amount) === 0;
  const mode = formData.participationMode || formData.PaymentType || 'Selected mode';

  const activeTransporter = getTransporter(credentials);
  const fromEmail = credentials?.emailUser || process.env.EMAIL_USER;
  const fromName = credentials?.instituteName || "MET Institute of Computer Science";
  const confName = credentials?.conferenceName || eventTitle || "Conference";
  const brandColor = credentials?.brandColor || '#B91C1C';
  
  const rawAdmin = (credentials?.adminEmails && credentials.adminEmails.length > 0)
    ? credentials.adminEmails
    : ADMIN_EMAILS;
  const adminList = parseEmailList(rawAdmin);
  const cleanCcList = adminList.filter((e) => e.toLowerCase() !== String(to || '').toLowerCase());

  const templateContext = { name, confName, fromName, eventDate, venue, amount, txnid, credentials };

  const emailSubject = credentials?.emailSubject
    ? replaceVariables(credentials.emailSubject, templateContext)
    : `Registration Acknowledgment: ${confName}`;

  const emailHeading = credentials?.emailHeading
    ? replaceVariables(credentials.emailHeading, templateContext)
    : 'Registration Acknowledgment';

  const emailBodyHtml = credentials?.emailBody
    ? `<div style="font-size: 15px; line-height: 1.6; color: #374151; margin: 16px 0;">${replaceVariables(credentials.emailBody, templateContext).replace(/\n/g, '<br/>')}</div>`
    : `
      <p style="font-size: 15px; line-height: 1.6; color: #374151;">
        Thank you for registering for the <strong>${confName}</strong>. 
        We have successfully received your registration details.
      </p>
    `;

  const emailFooterHtml = credentials?.emailFooter
    ? `<div style="margin-top: 30px; font-size: 14px; color: #4B5563;">${replaceVariables(credentials.emailFooter, templateContext).replace(/\n/g, '<br/>')}</div>`
    : `<p style="margin-top: 30px; font-size: 14px; color: #4B5563;">Warm regards,<br><strong>${fromName}</strong></p>`;

  const whatsappSection = credentials?.whatsappLink 
    ? `
      <div style="margin: 20px 0; border: 1px solid #10B981; border-radius: 12px; background: #ECFDF5; color: #065F46;">
        <p style="margin: 0 0 8px; font-weight: bold; font-size: 15px;">Action Required: Join WhatsApp Group</p>
        <p style="margin: 0; font-size: 14px; line-height: 1.5;">
          ${credentials.whatsappText || 'We have received your registration. Please join the WhatsApp group by clicking on the joining link:'}
        </p>
        <p style="margin: 12px 0 0;">
          <a href="${credentials.whatsappLink}" target="_blank" style="display: inline-block; padding: 10px 20px; background: #10B981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            Join WhatsApp Group
          </a>
        </p>
      </div>
    `
    : '';

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: emailSubject,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background: ${brandColor}; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">${fromName}</h1>
          <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Registration Acknowledgment</p>
        </div>
        
        <div style="padding: 28px; color: #1f2937;">
          <h2 style="color: ${brandColor}; margin-top: 0; font-size: 20px;">${emailHeading}</h2>
          <p style="font-size: 15px;">Dear <strong>${name}</strong>,</p>
          
          ${emailBodyHtml}

          ${whatsappSection}

          ${buildProgrammeSummary({ eventTitle: confName, eventDate, venue, credentials })}

          ${buildParticipantSummary({
            formData,
            amount,
            txnid,
            statusLabel: isFree ? 'Registered' : `Paid (${mode})`,
          })}

          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            Please preserve this email as your official registration acknowledgment for event entry and certificate issuance.
          </p>

          ${emailFooterHtml}
        </div>
      </div>
    `,
  };

  if (cleanCcList.length > 0) {
    mailOptions.cc = cleanCcList;
  }
  if (INTERNAL_AUDIT_EMAILS.length > 0) {
    mailOptions.bcc = INTERNAL_AUDIT_EMAILS;
  }

  const info = await activeTransporter.sendMail(mailOptions);
  console.log(`[Email] sendThankYouEmail sent to "${to}", CC: [${cleanCcList.join(', ')}], ID: ${info.messageId}`);
  return info;
}

async function sendFailureEmail({ to, name, eventTitle, eventDate, venue, formData = {}, credentials }) {
  const activeTransporter = getTransporter(credentials);
  const fromEmail = credentials?.emailUser || process.env.EMAIL_USER;
  const fromName = credentials?.instituteName || "MET Institute of Computer Science";
  const confName = credentials?.conferenceName || eventTitle || "Conference";
  
  const rawAdmin = (credentials?.adminEmails && credentials.adminEmails.length > 0)
    ? credentials.adminEmails
    : ADMIN_EMAILS;
  const adminList = parseEmailList(rawAdmin);
  const cleanCcList = adminList.filter((e) => e.toLowerCase() !== String(to || '').toLowerCase());

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: `Payment Failed: ${confName}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #B91C1C;">Payment Incomplete</h2>
        <p>Dear <strong>${name}</strong>,</p>
        <p>
          We received your registration request for <strong>${confName}</strong>, but the payment was not completed successfully.
        </p>
        ${buildProgrammeSummary({ eventTitle: confName, eventDate, venue, credentials })}
        ${buildParticipantSummary({
          formData,
          amount: null,
          txnid: formData.txnid,
          statusLabel: 'Payment failed',
        })}
        <p>
          You can try again by revisiting the registration page. If you need assistance, please contact the programme team.
        </p>
        <p style="margin-top: 30px;">Warm regards,<br><strong>${fromName}</strong></p>
      </div>
    `,
  };

  if (cleanCcList.length > 0) {
    mailOptions.cc = cleanCcList;
  }
  if (INTERNAL_AUDIT_EMAILS.length > 0) {
    mailOptions.bcc = INTERNAL_AUDIT_EMAILS;
  }

  const info = await activeTransporter.sendMail(mailOptions);
  console.log(`[Email] sendFailureEmail sent to "${to}", CC: [${cleanCcList.join(', ')}], ID: ${info.messageId}`);
  return info;
}

async function sendAdminNotificationEmail({ eventTitle, eventDate, venue, amount, txnid, formData = {}, status, credentials }) {
  const rawAdmin = (credentials?.adminEmails && credentials.adminEmails.length > 0)
    ? credentials.adminEmails
    : ADMIN_EMAILS;
  const adminList = parseEmailList(rawAdmin);
  if (!adminList.length) {
    console.log('[Email] No admin CC emails configured, skipping admin notification.');
    return;
  }

  const activeTransporter = getTransporter(credentials);
  const fromEmail = credentials?.emailUser || process.env.EMAIL_USER;
  const fromName = credentials?.instituteName || "MET Institute of Computer Science";
  const confName = credentials?.conferenceName || eventTitle || "Conference";
  
  const subjectPrefix = status === 'success' ? 'New Paid Registration' : status === 'failed' ? 'Payment Failed Registration' : 'New Registration';
  
  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: adminList,
    subject: `${subjectPrefix}: ${confName}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #111827;">Admin Registration Alert</h2>
        <p>A registration update has been recorded for the <strong>${confName}</strong> programme.</p>
        ${buildProgrammeSummary({ eventTitle: confName, eventDate, venue, credentials })}
        ${buildParticipantSummary({
          formData,
          amount,
          txnid,
          statusLabel: status,
        })}
      </div>
    `,
  };

  if (INTERNAL_AUDIT_EMAILS.length > 0) {
    mailOptions.bcc = INTERNAL_AUDIT_EMAILS;
  }

  const info = await activeTransporter.sendMail(mailOptions);
  console.log(`[Email] sendAdminNotificationEmail sent to [${adminList.join(', ')}], ID: ${info.messageId}`);
  return info;
}

module.exports = { sendThankYouEmail, sendFailureEmail, sendAdminNotificationEmail };
