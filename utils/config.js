const dotenv = require('dotenv');
dotenv.config();

function getCredentialsForEvent(event) {
  const slug = String(event?.slug || '').toLowerCase();
  const title = String(event?.title || '').toLowerCase();

  let prefix = null;

  if (slug.includes('pharmacy') || slug.includes('iop') || title.includes('pharmacy') || title.includes('iop')) {
    prefix = 'IOP';
  } else if (slug.includes('ics') || slug.includes('cism') || slug.includes('icetcism') || slug === 'dummy') {
    prefix = 'ICS'; // Handled by ICS or test keys
  } else if (slug.includes('pgdm') || title.includes('pgdm')) {
    prefix = 'PGDM';
  } else if (slug.includes('imm') || slug.includes('conference') || title.includes('imm') || title.includes('management') || slug === 'bus' || slug === 'mg-cr') {
    prefix = 'IMM';
  }

  // If no prefix is matched, return null to block insecure default payments
  if (!prefix) {
    return null;
  }

  // Read prefixed values or fall back to standard non-prefixed global ones
  const key = process.env[`${prefix}_PAYU_KEY`] || process.env.PAYU_KEY;
  const salt = process.env[`${prefix}_PAYU_SALT`] || process.env.PAYU_SALT;
  const baseUrl = process.env[`${prefix}_PAYU_BASE_URL`] || process.env.PAYU_BASE_URL || 'https://secure.payu.in/_payment';
  const emailUser = process.env[`${prefix}_EMAIL_USER`] || process.env.EMAIL_USER;
  const emailPass = process.env[`${prefix}_EMAIL_PASS`] || process.env.EMAIL_PASS;
  const adminEmail = process.env[`${prefix}_ADMIN_EMAIL`] || process.env.ADMIN_EMAIL;
  
  // Parse admin emails (can be comma-separated list)
  const rawAdminEmails = process.env[`${prefix}_ADMIN_EMAILS`] || process.env.ADMIN_EMAILS || adminEmail;
  const adminEmails = (rawAdminEmails ? rawAdminEmails.split(',') : [])
    .map((e) => e.trim())
    .filter(Boolean);

  const instituteName = process.env[`${prefix}_INSTITUTE_NAME`] || 'MET Institute of Computer Science';
  const conferenceName = process.env[`${prefix}_CONFERENCE_NAME`] || event?.title || 'Conference';
  const whatsappLink = process.env[`${prefix}_WHATSAPP_LINK`] || null;

  return {
    prefix,
    key,
    salt,
    baseUrl,
    emailUser,
    emailPass,
    adminEmail,
    adminEmails,
    instituteName,
    conferenceName,
    whatsappLink
  };
}

module.exports = {
  getCredentialsForEvent
};
