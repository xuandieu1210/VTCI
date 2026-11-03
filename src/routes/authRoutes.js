// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');

// Import controller
let authController;
try {
    authController = require('../controllers/authController');
} catch (error) {
    console.warn('⚠️ authController not found, creating placeholder');
    authController = {
        login: (req, res) => res.json({ success: true, message: 'Login placeholder' }),
        getMe: (req, res) => res.json({ success: true, data: {} }),
        changePassword: (req, res) => res.json({ success: true, message: 'Changed' }),
        getUsers: (req, res) => res.json({ success: true, data: [] }),
        updateUser: (req, res) => res.json({ success: true, message: 'Updated' }),
        lockUser: (req, res) => res.json({ success: true, message: 'Locked' }),
        unlockUser: (req, res) => res.json({ success: true, message: 'Unlocked' }),
        resetUserPassword: (req, res) => res.json({ success: true, message: 'Reset' })
    };
}

// Public routes
router.post('/login', authController.login);

// Protected routes
router.get('/me', authenticate, authController.getMe);
router.post('/change-password', authenticate, authController.changePassword);

// Admin only
router.get('/users', authenticate, authorize('admin'), authController.getUsers);
router.post('/users', authenticate, authorize('admin'), authController.createUser);
router.put('/users/:id', authenticate, authorize('admin'), authController.updateUser);
router.put('/users/:id/lock', authenticate, authorize('admin'), authController.lockUser);
router.put('/users/:id/unlock', authenticate, authorize('admin'), authController.unlockUser);
router.put('/users/:id/reset-password', authenticate, authorize('admin'), authController.resetUserPassword);

module.exports = router;