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
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
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
