require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function main() {
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL);

  await transporter.verify();
  console.log('SMTP verify passed');

  const info = await transporter.sendMail({
    from: `"MET Institute of Computer Science" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: 'SMTP test from RSVP backend',
    text: 'This is a test email from the RSVP backend.',
  });

  console.log('Mail sent:', info.response);
}

main().catch((err) => {
  console.error('Mail test failed');
  console.error(err);
  process.exit(1);
});
