const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { getAllRSVPs } = require('../controllers/adminController');
const { verifyToken, checkRole } = require('../middleware/verifyToken');


router.post('/login', adminController.loginUser);
router.post('/users', adminController.createUser);
router.get('/users', adminController.getAllUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);


router.get('/rsvps',  getAllRSVPs);

module.exports = router;
