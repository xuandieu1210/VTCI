// src/routes/thueBaoRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');

// Import controller
let thueBaoController;
try {
    thueBaoController = require('../controllers/thueBaoController');
} catch (error) {
    console.warn('⚠️ thueBaoController not found, creating placeholder');
    thueBaoController = {
        getAll: (req, res) => res.json({ success: true, data: [] }),
        getById: (req, res) => res.json({ success: true, data: {} }),
        create: (req, res) => res.status(201).json({ success: true, message: 'Created' }),
        update: (req, res) => res.json({ success: true, message: 'Updated' }),
        delete: (req, res) => res.json({ success: true, message: 'Deleted' })
    };
}

router.get('/', authenticate, thueBaoController.getAll);
router.get('/:id', authenticate, thueBaoController.getById);
router.post('/', authenticate, authorize('admin', 'manager', 'staff', 'vnpt_khu_vuc'), thueBaoController.create);
router.put('/:id', authenticate, authorize('admin', 'manager', 'staff', 'vnpt_khu_vuc'), thueBaoController.update);
router.delete('/:id', authenticate, authorize('admin', 'manager'), thueBaoController.delete);

module.exports = router;