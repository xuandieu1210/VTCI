// src/routes/importRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const { uploadImport } = require('../config/multer');

// Import controller
let importController;
try {
    importController = require('../controllers/importController');
} catch (error) {
    console.warn('⚠️ importController not found, creating placeholder');
    importController = {
        importExcel: (req, res) => res.json({ success: true, message: 'Import placeholder' }),
        downloadTemplate: (req, res) => res.json({ success: true, message: 'Template' }),
        getImportLogs: (req, res) => res.json({ success: true, data: [] }),
        exportErrors: (req, res) => res.json({ success: true, message: 'Export errors' })
    };
}

router.post('/excel', authenticate, authorize('admin', 'manager', 'vnpt_khu_vuc'), uploadImport.single('file'), importController.importExcel);
router.get('/template', authenticate, authorize('admin', 'manager', 'vnpt_khu_vuc'), importController.downloadTemplate);
router.get('/logs', authenticate, authorize('admin', 'manager', 'vnpt_khu_vuc'), importController.getImportLogs);
router.get('/errors/:log_id', authenticate, authorize('admin', 'manager', 'vnpt_khu_vuc'), importController.exportErrors);

module.exports = router;