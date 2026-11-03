// src/routes/cauHinhRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const controller = require('../controllers/cauHinhController');

router.get('/', authenticate, authorize('admin'), controller.getAll);
router.get('/group/:nhom', authenticate, authorize('admin'), controller.getByGroup);
router.post('/', authenticate, authorize('admin'), controller.create);
router.put('/:id', authenticate, authorize('admin'), controller.update);
router.delete('/:id', authenticate, authorize('admin'), controller.delete);
router.get('/:ma_cau_hinh', authenticate, controller.getByMa);

module.exports = router;