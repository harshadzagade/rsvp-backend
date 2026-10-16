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

// Institute Settings (Protected: SUPERADMIN Only)
router.get('/settings', verifyToken, checkRole('SUPERADMIN'), adminController.getInstituteSettings);
router.put('/settings/:code', verifyToken, checkRole('SUPERADMIN'), adminController.updateInstituteSetting);

// RSVPs (Protected: Token mandatory, scoped to user institute)
router.get('/rsvps', verifyToken, adminController.getAllRSVPs);
router.post('/rsvps/:txnid/verify', verifyToken, adminController.verifyRSVPPayment);

module.exports = router;
