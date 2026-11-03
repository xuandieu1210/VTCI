// src/routes/canhBaoRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const controller = require('../controllers/canhBaoController');

router.get('/', authenticate, controller.getList);
router.get('/thong-ke', authenticate, controller.thongKe);
router.post('/kiem-tra-tu-dong', authenticate, authorize('admin'), controller.kiemTraTuDong);
router.post('/', authenticate, authorize('admin', 'manager'), controller.create);
router.put('/:id/xu-ly', authenticate, authorize('admin', 'manager'), controller.xuLy);
router.put('/:id/dong', authenticate, authorize('admin', 'manager'), controller.dong);
router.get('/:id', authenticate, controller.getDetail);

module.exports = router;