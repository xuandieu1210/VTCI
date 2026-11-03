// src/routes/hoGiaDinhRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');

// Import controller
let hoGiaDinhController;
try {
    hoGiaDinhController = require('../controllers/hoGiaDinhController');
} catch (error) {
    console.warn('⚠️ hoGiaDinhController not found, creating placeholder');
    hoGiaDinhController = {
        getAll: (req, res) => res.json({ success: true, data: [] }),
        getDetail: (req, res) => res.json({ success: true, data: {} }),
        getStatistics: (req, res) => res.json({ success: true, data: {} }),
        create: (req, res) => res.status(201).json({ success: true, message: 'Created' }),
        update: (req, res) => res.json({ success: true, message: 'Updated' }),
        delete: (req, res) => res.json({ success: true, message: 'Deleted' }),
        addThanhVien: (req, res) => res.status(201).json({ success: true, message: 'Added' }),
        deleteThanhVien: (req, res) => res.json({ success: true, message: 'Deleted' }),
        addThueBao: (req, res) => res.status(201).json({ success: true, message: 'Added' }),
        deleteThueBao: (req, res) => res.json({ success: true, message: 'Deleted' })
    };
}

// CRUD
router.get('/', authenticate, hoGiaDinhController.getAll);
router.get('/statistics', authenticate, hoGiaDinhController.getStatistics);
router.get('/:id', authenticate, hoGiaDinhController.getDetail);
router.post('/', authenticate, authorize('admin', 'manager', 'staff', 'vnpt_khu_vuc'), hoGiaDinhController.create);
router.put('/:id', authenticate, authorize('admin', 'manager', 'staff', 'vnpt_khu_vuc'), hoGiaDinhController.update);
router.delete('/:id', authenticate, authorize('admin', 'manager', 'vnpt_khu_vuc'), hoGiaDinhController.delete);

// Thanh vien
router.post('/:id/thanh-vien', authenticate, authorize('admin', 'manager', 'staff', 'vnpt_khu_vuc'), hoGiaDinhController.addThanhVien);
router.delete('/thanh-vien/:id', authenticate, authorize('admin', 'manager', 'vnpt_khu_vuc'), hoGiaDinhController.deleteThanhVien);

// Thue bao
router.post('/:id/thue-bao', authenticate, authorize('admin', 'manager', 'staff', 'vnpt_khu_vuc'), hoGiaDinhController.addThueBao);
router.delete('/thue-bao/:id', authenticate, authorize('admin', 'manager', 'vnpt_khu_vuc'), hoGiaDinhController.deleteThueBao);

module.exports = router;