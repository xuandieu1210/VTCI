// src/routes/traCuuRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');

// Import controller
let traCuuController;
try {
    traCuuController = require('../controllers/traCuuController');
} catch (error) {
    console.warn('⚠️ traCuuController not found, creating placeholder');
    traCuuController = {
        traCuuHoGiaDinh: (req, res) => res.json({ success: true, data: [] }),
        traCuuThanhVien: (req, res) => res.json({ success: true, data: [] }),
        traCuuThueBao: (req, res) => res.json({ success: true, data: [] }),
        traCuuHoSo: (req, res) => res.json({ success: true, data: [] }),
        timKiemNhanh: (req, res) => res.json({ success: true, data: {} })
    };
}

router.post('/ho-gia-dinh', authenticate, traCuuController.traCuuHoGiaDinh);
router.post('/thanh-vien', authenticate, traCuuController.traCuuThanhVien);
router.post('/thue-bao', authenticate, traCuuController.traCuuThueBao);
router.post('/ho-so', authenticate, traCuuController.traCuuHoSo);
router.get('/nhanh', authenticate, traCuuController.timKiemNhanh);

module.exports = router;