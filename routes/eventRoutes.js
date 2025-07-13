const express = require('express');
const router = express.Router();
const { createEvent, getAllEvents , getEventBySlug , getEventById} = require('../controllers/eventController');

router.post('/events', createEvent);
router.get('/events', getAllEvents);
router.get('/events/slug/:slug', getEventBySlug);
router.get('/events/:id', getEventById);

module.exports = router;
