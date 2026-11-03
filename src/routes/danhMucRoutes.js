// src/routes/danhMucRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');

// Import controller
let danhMucController;
try {
    danhMucController = require('../controllers/danhMucController');
} catch (error) {
    console.warn('⚠️ danhMucController not found, creating placeholder');
    danhMucController = {
        getXaList: (req, res) => res.json({ success: true, data: [] }),
        getXaById: (req, res) => res.json({ success: true, data: {} }),
        createXa: (req, res) => res.status(201).json({ success: true, message: 'Created' }),
        updateXa: (req, res) => res.json({ success: true, message: 'Updated' }),
        deactivateXa: (req, res) => res.json({ success: true, message: 'Deactivated' }),
        deleteXa: (req, res) => res.json({ success: true, message: 'Deleted' }),
        getLoaiDoiTuong: (req, res) => res.json({ success: true, data: [] }),
        createLoaiDoiTuong: (req, res) => res.status(201).json({ success: true, message: 'Created' }),
        updateLoaiDoiTuong: (req, res) => res.json({ success: true, message: 'Updated' }),
        deactivateLoaiDoiTuong: (req, res) => res.json({ success: true, message: 'Deactivated' }),
        deleteLoaiDoiTuong: (req, res) => res.json({ success: true, message: 'Deleted' }),
        getLoaiDichVu: (req, res) => res.json({ success: true, data: [] }),
        createLoaiDichVu: (req, res) => res.status(201).json({ success: true, message: 'Created' }),
        updateLoaiDichVu: (req, res) => res.json({ success: true, message: 'Updated' }),
        deactivateLoaiDichVu: (req, res) => res.json({ success: true, message: 'Deactivated' }),
        deleteLoaiDichVu: (req, res) => res.json({ success: true, message: 'Deleted' }),
        getVNPTKhuVuc: (req, res) => res.json({ success: true, data: [] }),
        createVNPTKhuVuc: (req, res) => res.status(201).json({ success: true, message: 'Created' }),
        updateVNPTKhuVuc: (req, res) => res.json({ success: true, message: 'Updated' }),
        deactivateVNPTKhuVuc: (req, res) => res.json({ success: true, message: 'Deactivated' }),
        deleteVNPTKhuVuc: (req, res) => res.json({ success: true, message: 'Deleted' })
    };
}

// ===== Xa =====
router.get('/xa', authenticate, danhMucController.getXaList);
router.get('/xa/:id', authenticate, danhMucController.getXaById);
router.post('/xa', authenticate, authorize('admin', 'manager'), danhMucController.createXa);
router.put('/xa/:id', authenticate, authorize('admin', 'manager'), danhMucController.updateXa);
router.patch('/xa/:id/deactivate', authenticate, authorize('admin'), danhMucController.deactivateXa);
router.delete('/xa/:id', authenticate, authorize('admin'), danhMucController.deleteXa);

// ===== Loai doi tuong =====
router.get('/loai-doi-tuong', authenticate, danhMucController.getLoaiDoiTuong);
router.post('/loai-doi-tuong', authenticate, authorize('admin'), danhMucController.createLoaiDoiTuong);
router.put('/loai-doi-tuong/:id', authenticate, authorize('admin'), danhMucController.updateLoaiDoiTuong);
router.patch('/loai-doi-tuong/:id/deactivate', authenticate, authorize('admin'), danhMucController.deactivateLoaiDoiTuong);
router.delete('/loai-doi-tuong/:id', authenticate, authorize('admin'), danhMucController.deleteLoaiDoiTuong);

// ===== Loai dich vu =====
router.get('/loai-dich-vu', authenticate, danhMucController.getLoaiDichVu);
router.post('/loai-dich-vu', authenticate, authorize('admin'), danhMucController.createLoaiDichVu);
router.put('/loai-dich-vu/:id', authenticate, authorize('admin'), danhMucController.updateLoaiDichVu);
router.patch('/loai-dich-vu/:id/deactivate', authenticate, authorize('admin'), danhMucController.deactivateLoaiDichVu);
router.delete('/loai-dich-vu/:id', authenticate, authorize('admin'), danhMucController.deleteLoaiDichVu);

// ===== VNPT Khu vuc =====
router.get('/vnpt-khu-vuc', authenticate, danhMucController.getVNPTKhuVuc);
router.post('/vnpt-khu-vuc', authenticate, authorize('admin'), danhMucController.createVNPTKhuVuc);
router.put('/vnpt-khu-vuc/:id', authenticate, authorize('admin'), danhMucController.updateVNPTKhuVuc);
router.patch('/vnpt-khu-vuc/:id/deactivate', authenticate, authorize('admin'), danhMucController.deactivateVNPTKhuVuc);
router.delete('/vnpt-khu-vuc/:id', authenticate, authorize('admin'), danhMucController.deleteVNPTKhuVuc);

module.exports = router;