require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rsvpRoutes = require('./routes/rsvpRoutes');
const eventRoutes = require('./routes/eventRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', rsvpRoutes);
app.use('/api', eventRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
