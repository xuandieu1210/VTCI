// src/routes/thanhVienRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');

// Import controller
let thanhVienController;
try {
    thanhVienController = require('../controllers/thanhVienController');
} catch (error) {
    console.warn('⚠️ thanhVienController not found, creating placeholder');
    thanhVienController = {
        getAll: (req, res) => res.json({ success: true, data: [] }),
        getById: (req, res) => res.json({ success: true, data: {} }),
        create: (req, res) => res.status(201).json({ success: true, message: 'Created' }),
        update: (req, res) => res.json({ success: true, message: 'Updated' }),
        delete: (req, res) => res.json({ success: true, message: 'Deleted' })
    };
}

router.get('/', authenticate, thanhVienController.getAll);
router.get('/:id', authenticate, thanhVienController.getById);
router.post('/', authenticate, authorize('admin', 'manager', 'staff', 'vnpt_khu_vuc'), thanhVienController.create);
router.put('/:id', authenticate, authorize('admin', 'manager', 'staff', 'vnpt_khu_vuc'), thanhVienController.update);
router.delete('/:id', authenticate, authorize('admin', 'manager'), thanhVienController.delete);

module.exports = router;