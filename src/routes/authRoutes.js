// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');

const authController = require('../controllers/authController');

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