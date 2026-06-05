const nodemailer = require('nodemailer');

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

const INTERNAL_AUDIT_EMAILS = ['anirudham_ics@met.edu', 'manojkumarp_iit@met.edu', 'harshadz_ics@met.edu'];

const formatDate = (value) => {
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
    <p style="margin: 6px 0;"><strong>Date:</strong> ${formatDate(eventDate)}</p>
    <p style="margin: 6px 0;"><strong>Venue:</strong> ${venue || credentials?.instituteName || 'MET Institute of Computer Science'}</p>
  </div>
`;

const buildParticipantSummary = ({ formData = {}, amount, txnid, statusLabel }) => {
  const rows = [
    ['Name', formData.fullName || formData.FullName || formData.name || ''],
    ['Email', formData.email || formData.Email || ''],
    ['Mobile', formData.mobile || formData.Mobile || formData['WhatsApp Number'] || ''],
    ['Category', formData.category || formData.ParticipationCategory || ''],
    ['Participation Mode', formData.participationMode || formData.PaymentType || 'Online'],
    ['Organisation', formData.organisation || formData.instituteName || formData['Name of Institute/College'] || ''],
    ['Designation', formData.designation || formData.Designation || ''],
    ['Certificate Name', formData.certificateName || formData.FullName || ''],
    ['Joining Reason', formData.joiningReason || ''],
    ['Transaction ID', txnid],
    ['Payment Status', statusLabel],
    ['Amount', amount || amount === 0 ? `Rs. ${Number(amount).toLocaleString('en-IN')}` : 'Not completed'],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  return `
    <table style="margin: 20px 0; border-collapse: collapse; width: 100%;">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb; width: 220px; vertical-align: top;">${label}</td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${value}</td>
        </tr>
      `).join('')}
    </table>
  `;
};

async function sendThankYouEmail({ to, name, eventTitle, eventDate, venue, amount, txnid, formData = {}, credentials }) {
  const isFree = !amount || Number(amount) === 0;
  const mode = formData.participationMode || formData.PaymentType || 'Selected mode';

  const activeTransporter = getTransporter(credentials);
  const fromEmail = credentials?.emailUser || process.env.EMAIL_USER;
  const fromName = credentials?.instituteName || "MET Institute of Computer Science";
  const confName = credentials?.conferenceName || eventTitle || "Conference";
  
  const adminList = credentials?.adminEmails || ADMIN_EMAILS;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    cc: adminList,
    bcc: INTERNAL_AUDIT_EMAILS,
    subject: `${isFree ? 'Registration Confirmed' : 'Payment Confirmed'}: ${confName}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #B91C1C;">Registration Confirmation</h2>
        <p>Dear <strong>${name}</strong>,</p>
        <p>
          Thank you for registering for the <strong>${confName}</strong>. 
          We have successfully received your details and payment.
        </p>
        ${buildProgrammeSummary({ eventTitle: confName, eventDate, venue, credentials })}
        ${buildParticipantSummary({
          formData,
          amount,
          txnid,
          statusLabel: isFree ? 'Registered' : `Paid (${mode})`,
        })}
        <p> 
          We look forward to seeing you!
        </p>
        <p style="margin-top: 30px;">Warm regards,<br><strong>${fromName}</strong></p>
      </div>
    `,
  };

  await activeTransporter.sendMail(mailOptions);
}

async function sendFailureEmail({ to, name, eventTitle, eventDate, venue, formData = {}, credentials }) {
  const activeTransporter = getTransporter(credentials);
  const fromEmail = credentials?.emailUser || process.env.EMAIL_USER;
  const fromName = credentials?.instituteName || "MET Institute of Computer Science";
  const confName = credentials?.conferenceName || eventTitle || "Conference";
  
  const adminList = credentials?.adminEmails || ADMIN_EMAILS;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    cc: adminList,
    bcc: INTERNAL_AUDIT_EMAILS,
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

  await activeTransporter.sendMail(mailOptions);
}

async function sendAdminNotificationEmail({ eventTitle, eventDate, venue, amount, txnid, formData = {}, status, credentials }) {
  const adminList = credentials?.adminEmails || ADMIN_EMAILS;
  if (!adminList.length) return;

  const activeTransporter = getTransporter(credentials);
  const fromEmail = credentials?.emailUser || process.env.EMAIL_USER;
  const fromName = credentials?.instituteName || "MET Institute of Computer Science";
  const confName = credentials?.conferenceName || eventTitle || "Conference";
  
  const subjectPrefix = status === 'success' ? 'New Paid Registration' : status === 'failed' ? 'Payment Failed Registration' : 'New Registration';
  
  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: adminList,
    bcc: INTERNAL_AUDIT_EMAILS,
    subject: `${subjectPrefix}: ${confName}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #111827;">Admin Registration Alert</h2>
        <p>A registration update has been recorded for the ${confName} programme.</p>
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

  await activeTransporter.sendMail(mailOptions);
}

module.exports = { sendThankYouEmail, sendFailureEmail, sendAdminNotificationEmail };
