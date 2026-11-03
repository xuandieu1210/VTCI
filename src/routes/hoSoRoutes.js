// src/routes/hoSoRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const { uploadHoSo } = require('../config/multer');
const controller = require('../controllers/hoSoController');

router.get('/', authenticate, controller.getAll);
router.get('/download/:id', authenticate, controller.download);
router.get('/:id', authenticate, controller.getById);
router.post('/', authenticate, authorize('admin', 'manager', 'staff', 'vnpt_khu_vuc'), uploadHoSo.single('file'), controller.upload);
router.put('/:id', authenticate, authorize('admin', 'manager', 'staff', 'vnpt_khu_vuc'), controller.update);
router.delete('/:id', authenticate, authorize('admin', 'manager'), controller.delete);
router.get('/check-expired', authenticate, authorize('admin', 'manager'), controller.checkExpired);

module.exports = router;