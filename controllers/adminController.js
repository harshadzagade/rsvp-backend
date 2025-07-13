const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const jwt = require('jsonwebtoken');
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
      data: { name, email, password: hashedPassword, role, institute },
    });

    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, institute: user.institute });
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

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, institute: user.institute } });
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

// Update role or institute
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, institute } = req.body;

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { ...(role && { role }), ...(institute && { institute }) },
    });

    res.json({ message: 'User updated', user });
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


// Get all RSVP records with event details
// exports.getAllRSVPs = async (req, res) => {
//   try {
//     const rsvps = await prisma.rSVP.findMany({
//       include: { event: true },
//       orderBy: { createdAt: 'desc' }
//     });
//     res.json(rsvps);
//   } catch (err) {
//     console.error('Get RSVP error:', err);
//     res.status(500).json({ error: 'Failed to fetch RSVP data' });
//   }
// };
exports.getAllRSVPs = async (req, res) => {
  try {
    const rsvps = await prisma.rSVP.findMany({
      include: { event: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(rsvps);
  } catch (err) {
    console.error('Error fetching RSVPs:', err);
    res.status(500).json({ error: 'Could not fetch RSVP data' });
  }
};
