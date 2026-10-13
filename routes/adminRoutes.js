const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, checkRole } = require('../middleware/verifyToken');

// Auth (Public)
router.post('/login', adminController.loginUser);

// Users Management (Protected: Only SUPERADMIN can manage other admins)
router.post('/users', verifyToken, checkRole('SUPERADMIN'), adminController.createUser);
router.get('/users', verifyToken, adminController.getAllUsers);
router.put('/users/:id', verifyToken, checkRole('SUPERADMIN'), adminController.updateUser);
router.delete('/users/:id', verifyToken, checkRole('SUPERADMIN'), adminController.deleteUser);

// Institute Settings (Protected: ADMIN & SUPERADMIN)
router.get('/settings', verifyToken, adminController.getInstituteSettings);
router.put('/settings/:code', verifyToken, checkRole('ADMIN', 'SUPERADMIN'), adminController.updateInstituteSetting);

// RSVPs (Protected: Token mandatory, scoped to user institute)
router.get('/rsvps', verifyToken, adminController.getAllRSVPs);

module.exports = router;
