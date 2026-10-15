const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
dotenv.config();

const prisma = new PrismaClient();
const settingsCache = new Map();

function parseEmailList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    raw = raw.join(',');
  }
  return String(raw)
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && e.includes('@'));
}

// Helper to refresh settings cache from database
async function refreshSettingsCache() {
  try {
    const allSettings = await prisma.instituteSetting.findMany();
    settingsCache.clear();
    for (const s of allSettings) {
      if (s.instituteCode) {
        settingsCache.set(s.instituteCode.toUpperCase(), s);
      }
    }
  } catch (err) {
    console.error('Failed to preload institute settings into cache:', err.message);
  }
}

function setSettingInCache(code, setting) {
  if (code && setting) {
    settingsCache.set(code.toUpperCase(), setting);
  }
}

// Initial cache load
refreshSettingsCache();

function getCredentialsForEvent(event) {
  const slug = String(event?.slug || '').toLowerCase();
  const title = String(event?.title || '').toLowerCase();

  let prefix = event?.institute ? String(event.institute).toUpperCase() : null;

  if (!prefix) {
    if (slug.includes('pharmacy') || slug.includes('iop') || title.includes('pharmacy') || title.includes('iop')) {
      prefix = 'IOP';
    } else if (slug.includes('ics') || slug.includes('cism') || slug.includes('icetcism') || slug === 'dummy') {
      prefix = 'ICS';
    } else if (slug.includes('pgdm') || title.includes('pgdm')) {
      prefix = 'PGDM';
    } else if (slug.includes('imm') || slug.includes('conference') || title.includes('imm') || title.includes('management') || slug === 'bus' || slug === 'mg-cr' || slug.includes('sfx')) {
      prefix = 'IMM';
    } else if (slug.includes('mrv') || slug.includes('mun') || title.includes('mrv') || title.includes('mun')) {
      prefix = 'MRV';
    }
  }

  // If no prefix is matched, return null to block insecure default payments
  if (!prefix) {
    return null;
  }

  const dbSetting = settingsCache.get(prefix);

  // Read DB values first, then prefixed env values, then fallback globals
  const key = dbSetting?.payuKey || process.env[`${prefix}_PAYU_KEY`] || (prefix === 'MRV' ? (settingsCache.get('IMM')?.payuKey || process.env.IMM_PAYU_KEY || process.env.PAYU_KEY) : process.env.PAYU_KEY);
  const salt = dbSetting?.payuSalt || process.env[`${prefix}_PAYU_SALT`] || (prefix === 'MRV' ? (settingsCache.get('IMM')?.payuSalt || process.env.IMM_PAYU_SALT || process.env.PAYU_SALT) : process.env.PAYU_SALT);
  const baseUrl = dbSetting?.payuBaseUrl || process.env[`${prefix}_PAYU_BASE_URL`] || process.env.PAYU_BASE_URL || 'https://secure.payu.in/_payment';
  
  const emailUser = dbSetting?.emailUser || process.env[`${prefix}_EMAIL_USER`] || (prefix === 'MRV' ? (settingsCache.get('IMM')?.emailUser || process.env.IMM_EMAIL_USER || process.env.EMAIL_USER) : process.env.EMAIL_USER);
  const emailPass = dbSetting?.emailPass || process.env[`${prefix}_EMAIL_PASS`] || (prefix === 'MRV' ? (settingsCache.get('IMM')?.emailPass || process.env.IMM_EMAIL_PASS || process.env.EMAIL_PASS) : process.env.EMAIL_PASS);
  
  // Parse CC / admin emails (handles commas, semicolons, and spaces)
  const rawAdminEmails = dbSetting?.adminEmails || process.env[`${prefix}_ADMIN_EMAILS`] || process.env.ADMIN_EMAILS || process.env[`${prefix}_ADMIN_EMAIL`] || process.env.ADMIN_EMAIL;
  const adminEmails = parseEmailList(rawAdminEmails);

  const instituteName = dbSetting?.instituteName || process.env[`${prefix}_INSTITUTE_NAME`] || 'Mumbai Educational Trust';
  const cleanSlug = slug.replace(/-/g, '_').toUpperCase();

  const conferenceName = process.env[`${prefix}_CONFERENCE_NAME_${cleanSlug}`]
    || event?.title
    || process.env[`${prefix}_CONFERENCE_NAME`]
    || 'Seminar / Conference';

  const whatsappLink = dbSetting?.whatsappLink
    || process.env[`${prefix}_WHATSAPP_LINK_${cleanSlug}`]
    || process.env[`${prefix}_WHATSAPP_LINK`]
    || null;

  const whatsappText = dbSetting?.whatsappText
    || process.env[`${prefix}_WHATSAPP_TEXT_${cleanSlug}`]
    || process.env[`${prefix}_WHATSAPP_TEXT`]
    || 'We have received your registration. Please join the WhatsApp group by clicking on the joining link:';

  const emailSubject = dbSetting?.emailSubject || null;
  const emailHeading = dbSetting?.emailHeading || null;
  const emailBody = dbSetting?.emailBody || null;
  const emailFooter = dbSetting?.emailFooter || null;
  const brandColor = dbSetting?.brandColor || '#B91C1C';

  return {
    prefix,
    slug,
    key,
    salt,
    baseUrl,
    emailUser,
    emailPass,
    adminEmail: adminEmails[0] || null,
    adminEmails,
    instituteName,
    conferenceName,
    whatsappLink,
    whatsappText,
    emailSubject,
    emailHeading,
    emailBody,
    emailFooter,
    brandColor
  };
}

module.exports = {
  getCredentialsForEvent,
  refreshSettingsCache,
  setSettingInCache,
  parseEmailList
};
