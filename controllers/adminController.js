const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { refreshSettingsCache } = require('../utils/config');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not defined!");

// Create new admin or viewer or superadmin
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role = 'VIEWER', institute } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'User already exists with this email.' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, institute: institute || null },
      select: { id: true, name: true, email: true, role: true, institute: true, createdAt: true }
    });

    res.json(user);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// Login and get JWT token
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id, role: user.role, institute: user.institute }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, institute: user.institute } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, institute: true, createdAt: true },
    });
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Update role, institute, name, password
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, institute, password } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (institute !== undefined) updateData.institute = institute;
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, institute: true, createdAt: true }
    });

    res.json({ message: 'User updated successfully', user });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Get all Institute Settings (PayU, Email, CC recipients, WhatsApp)
exports.getInstituteSettings = async (req, res) => {
  try {
    const settings = await prisma.instituteSetting.findMany({
      orderBy: { instituteCode: 'asc' }
    });
    res.json(settings);
  } catch (err) {
    console.error('Get institute settings error:', err);
    res.status(500).json({ error: 'Failed to fetch institute settings' });
  }
};

// Update or Create Institute Setting
exports.updateInstituteSetting = async (req, res) => {
  try {
    const { code } = req.params;
    const {
      instituteName,
      payuKey,
      payuSalt,
      payuBaseUrl,
      emailUser,
      emailPass,
      adminEmails,
      whatsappLink,
      whatsappText,
      emailSubject,
      emailHeading,
      emailBody,
      emailFooter,
      brandColor
    } = req.body;

    const setting = await prisma.instituteSetting.upsert({
      where: { instituteCode: code.toUpperCase() },
      update: {
        instituteName: instituteName || code.toUpperCase(),
        payuKey,
        payuSalt,
        payuBaseUrl: payuBaseUrl || 'https://secure.payu.in/_payment',
        emailUser,
        emailPass,
        adminEmails,
        whatsappLink,
        whatsappText,
        emailSubject,
        emailHeading,
        emailBody,
        emailFooter,
        brandColor: brandColor || '#B91C1C'
      },
      create: {
        instituteCode: code.toUpperCase(),
        instituteName: instituteName || code.toUpperCase(),
        payuKey,
        payuSalt,
        payuBaseUrl: payuBaseUrl || 'https://secure.payu.in/_payment',
        emailUser,
        emailPass,
        adminEmails,
        whatsappLink,
        whatsappText,
        emailSubject,
        emailHeading,
        emailBody,
        emailFooter,
        brandColor: brandColor || '#B91C1C'
      }
    });

    await refreshSettingsCache();

    res.json({ message: `Settings for ${code.toUpperCase()} updated successfully`, setting });
  } catch (err) {
    console.error('Update institute setting error:', err);
    res.status(500).json({ error: 'Failed to update institute setting' });
  }
};

// Get all RSVP records with event details (scoped by user's assigned institute if not SUPERADMIN)
exports.getAllRSVPs = async (req, res) => {
  try {
    const user = req.user;
    const { institute: queryInstitute } = req.query;

    let whereClause = {};

    // Check if user has an assigned institute and is restricted
    const effectiveInstitute = (user && user.role !== 'SUPERADMIN' && user.institute && !['ALL', 'MUMBAI EDUCATIONAL TRUST'].includes(user.institute.toUpperCase()))
      ? user.institute.toUpperCase()
      : queryInstitute && queryInstitute !== 'ALL'
        ? queryInstitute.toUpperCase()
        : null;

    if (effectiveInstitute) {
      whereClause = {
        event: {
          OR: [
            { institute: effectiveInstitute },
            { slug: { contains: effectiveInstitute.toLowerCase() } }
          ]
        }
      };
    }

    const rsvps = await prisma.rSVP.findMany({
      where: whereClause,
      include: { event: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(rsvps);
  } catch (err) {
    console.error('Error fetching RSVPs:', err);
    res.status(500).json({ error: 'Could not fetch RSVP data' });
  }
};
