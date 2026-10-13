const express = require('express');
const router = express.Router();
const { createEvent, getAllEvents, getEventBySlug, getEventById, updateEvent, toggleEventStatus, deleteEvent } = require('../controllers/eventController');
const { verifyToken, checkRole } = require('../middleware/verifyToken');

// Public read routes
router.get('/events', getAllEvents);
router.get('/events/slug/:slug', getEventBySlug);
router.get('/events/:id', getEventById);

// Protected admin write routes
router.post('/events', verifyToken, checkRole('ADMIN', 'SUPERADMIN'), createEvent);
router.put('/events/:id', verifyToken, checkRole('ADMIN', 'SUPERADMIN'), updateEvent);
router.patch('/events/:id/status', verifyToken, checkRole('ADMIN', 'SUPERADMIN'), toggleEventStatus);
router.delete('/events/:id', verifyToken, checkRole('SUPERADMIN'), deleteEvent);

module.exports = router;
