const express = require('express');
const router = express.Router();
const { registerRSVP, handlePayUSuccess, handlePayUFailure } = require('../controllers/rsvpController');

router.post('/rsvp', registerRSVP);
router.post('/rsvp/success', handlePayUSuccess);
router.post('/rsvp/failure', handlePayUFailure);

module.exports = router;
