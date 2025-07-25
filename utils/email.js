  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // use TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const ADMIN_EMAILS = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(',').map(email => email.trim())
  : [];

  async function sendThankYouEmail({ to, name, eventTitle, amount, txnid }) {
    const mailOptions = {
      from: `"Institute Of Mass Media" <${process.env.EMAIL_USER}>`,
      to,
      cc: ADMIN_EMAILS || [ 'anirudham_ics@met.edu' , 'manojkumarp_iit@met.edu' , 'harshadz_ics@met.edu' ],
      subject: `${isFree ? '✅ Registration Confirmed' : '✅ Payment Confirmed'}: ${eventTitle}`,
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #D32F2F;">Thank You for Registering!</h2>
          <p>Dear <strong>${name}</strong>,</p>

          <p>We are pleased to confirm your successful registration for:</p>
          <h3 style="color: #1976D2;">${eventTitle}</h3>

          <table style="margin: 20px 0; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 12px; font-weight: bold;">Amount ${isFree ? '' : 'Paid'}:</td>
            <td style="padding: 8px 12px;">${isFree ? 'Free Registration' : `₹${amount}`}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: bold;">Transaction ID:</td>
              <td style="padding: 8px 12px;">${txnid}</td>
            </tr>
          </table>

          <p>We look forward to seeing you at the event. Stay tuned for more details via email closer to the event date.</p>

          <p style="margin-top: 30px;">Warm regards,<br>
          <strong>MUMBAI EDUCATIONAL TRUST</strong><br>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  }


  async function sendFailureEmail({ to, name, eventTitle }) {
    const mailOptions = {
      from: `"Institute Of Mass Media" <${process.env.EMAIL_USER}>`,
      to,
      cc: ADMIN_EMAILS || [ 'anirudham_ics@met.edu' , 'manojkumarp_iit@met.edu' , 'harshadz_ics@met.edu' ],
      subject: `❌ Payment Failed: ${eventTitle}`,
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #D32F2F;">Payment Failed</h2>
          <p>Dear <strong>${name}</strong>,</p>

          <p>Unfortunately, your payment for <strong>${eventTitle}</strong> was not successful.</p>

          <p>You can try again by revisiting the event registration page. If you encounter further issues, feel free to reach out to us.</p>

          <p style="margin-top: 30px;">Warm regards,<br>
          <strong>MUMBAI EDUCATIONAL TRUST</strong><br>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  }

  module.exports = { sendThankYouEmail, sendFailureEmail };
