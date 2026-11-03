// src/routes/thongKeRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const controller = require('../controllers/thongKeController');

router.get('/dashboard', authenticate, controller.getDashboard);
router.get('/ho-gia-dinh', authenticate, controller.baoCaoHoGiaDinh);
router.get('/thue-bao', authenticate, controller.baoCaoThueBao);
router.get('/thue-bao-moi', authenticate, controller.baoCaoThueBaoMoi);
router.get('/ho-so', authenticate, controller.baoCaoHoSo);
router.get('/ho-so-thieu-khu-vuc', authenticate, controller.baoCaoHoSoThieuTheoKhuVuc);
router.get('/export/:loai', authenticate, controller.exportBaoCao);

module.exports = router;