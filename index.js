require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fileUpload = require('express-fileupload');
const rsvpRoutes = require('./routes/rsvpRoutes');
const eventRoutes = require('./routes/eventRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

// Trust reverse proxy (Nginx / IIS / Cloudflare) so express-rate-limit and IP detection work accurately
app.set('trust proxy', 1);

// Security Headers with Helmet (Allows embedding if needed while protecting against XSS/Sniffing)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Leave CSP flexible for embedded PayU forms and external assets
}));

// Rate Limiters
// 1. Strict Limiter for Admin Login (Blocks Brute Force: max 10 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
});
app.use('/api/admin/login', loginLimiter);

// 2. RSVP Registration Limiter (Blocks spam submissions: max 30 per 10 minutes per IP)
const rsvpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registrations from this network. Please wait a moment.' },
});
app.use('/api/rsvp', (req, res, next) => {
  // Only rate-limit POST /rsvp initiation, never PayU webhooks
  if (req.method === 'POST' && req.path === '') {
    return rsvpLimiter(req, res, next);
  }
  next();
});

const allowedOrigins = [
  'https://events.met.edu',
  'http://events.met.edu',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://secure.payu.in',
  'https://test.payu.in',
];

function isAllowedOrigin(origin) {
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) return true;

  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'events.met.edu' ||
      hostname.endsWith('.met.edu') ||
      hostname === 'secure.payu.in' ||
      hostname === 'test.payu.in' ||
      hostname.endsWith('.payu.in') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    console.error('Blocked by CORS:', origin);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'tmp'),
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', rsvpRoutes);
app.use('/api', eventRoutes);
app.use('/api', uploadRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
