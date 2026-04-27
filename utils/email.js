const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const ADMIN_EMAILS = [
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : []),
  ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : []),
]
  .map((email) => email.trim())
  .filter(Boolean);

const INTERNAL_AUDIT_EMAILS = ['anirudham_ics@met.edu', 'manojkumarp_iit@met.edu', 'harshadz_ics@met.edu'];

const formatDate = (value) => {
  if (!value) return '9 May 2026';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const buildProgrammeSummary = ({ eventTitle, eventDate, venue }) => `
  <div style="margin: 20px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fafafa;">
    <h3 style="margin: 0 0 12px; color: #111827;">Programme Details</h3>
    <p style="margin: 6px 0;"><strong>Programme:</strong> ${eventTitle}</p>
    <p style="margin: 6px 0;"><strong>Date:</strong> ${formatDate(eventDate)}</p>
    <p style="margin: 6px 0;"><strong>Venue:</strong> ${venue || 'MET Institute of PGDM'}</p>
  </div>
`;

const buildParticipantSummary = ({ formData = {}, amount, txnid, statusLabel }) => {
  const rows = [
    ['Name', formData.fullName || formData.name],
    ['Email', formData.email],
    ['Mobile', formData.mobile],
    ['Category', formData.category],
    ['Participation Mode', formData.participationMode],
    ['Organisation', formData.organisation],
    ['Designation', formData.designation],
    ['Certificate Name', formData.certificateName],
    ['Joining Reason', formData.joiningReason],
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

async function sendThankYouEmail({ to, name, eventTitle, eventDate, venue, amount, txnid, formData = {} }) {
  const isFree = !amount || Number(amount) === 0;
  const mode = formData.participationMode || 'Selected mode';
  const mailOptions = {
    from: `"MET Institute of PGDM" <${process.env.EMAIL_USER}>`,
    to,
    cc: ADMIN_EMAILS,
    bcc: INTERNAL_AUDIT_EMAILS,
    subject: `${isFree ? 'Registration Confirmed' : 'Payment Confirmed'}: ${eventTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #B91C1C;">Registration Confirmation</h2>
        <p>Dear <strong>${name}</strong>,</p>
        <p>
          This is to confirm your registration for the MDP programme by Institution of PGDM on
          <strong> "Prevention of Sexual Harassment at Workplace: Training for Corporates and Academic Institutions"</strong>.
        </p>
        ${buildProgrammeSummary({ eventTitle, eventDate, venue })}
        ${buildParticipantSummary({
          formData,
          amount,
          txnid,
          statusLabel: isFree ? 'Registered' : `Paid (${mode})`,
        })}
        <p>
          We look forward to your participation. Please keep this email for your reference. The certificate will be prepared using the name submitted in the registration form.
        </p>
        <p style="margin-top: 30px;">Warm regards,<br><strong>MET Institute of PGDM</strong></p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

async function sendFailureEmail({ to, name, eventTitle, eventDate, venue, formData = {} }) {
  const mailOptions = {
    from: `"MET Institute of PGDM" <${process.env.EMAIL_USER}>`,
    to,
    cc: ADMIN_EMAILS,
    bcc: INTERNAL_AUDIT_EMAILS,
    subject: `Payment Failed: ${eventTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #B91C1C;">Payment Incomplete</h2>
        <p>Dear <strong>${name}</strong>,</p>
        <p>
          We received your registration request for the MDP programme on <strong>${formatDate(eventDate)}</strong>, but the payment was not completed successfully.
        </p>
        ${buildProgrammeSummary({ eventTitle, eventDate, venue })}
        ${buildParticipantSummary({
          formData,
          amount: null,
          txnid: formData.txnid,
          statusLabel: 'Payment failed',
        })}
        <p>
          You can try again by revisiting the registration page. If you need assistance, please contact the programme team.
        </p>
        <p style="margin-top: 30px;">Warm regards,<br><strong>MET Institute of PGDM</strong></p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

async function sendAdminNotificationEmail({ eventTitle, eventDate, venue, amount, txnid, formData = {}, status }) {
  if (!ADMIN_EMAILS.length) return;

  const subjectPrefix = status === 'success' ? 'New Paid Registration' : status === 'failed' ? 'Payment Failed Registration' : 'New Registration';
  const mailOptions = {
    from: `"MET Institute of PGDM" <${process.env.EMAIL_USER}>`,
    to: ADMIN_EMAILS,
    bcc: INTERNAL_AUDIT_EMAILS,
    subject: `${subjectPrefix}: ${eventTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #111827;">Admin Registration Alert</h2>
        <p>A registration update has been recorded for the PGDM programme.</p>
        ${buildProgrammeSummary({ eventTitle, eventDate, venue })}
        ${buildParticipantSummary({
          formData,
          amount,
          txnid,
          statusLabel: status,
        })}
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendThankYouEmail, sendFailureEmail, sendAdminNotificationEmail };
