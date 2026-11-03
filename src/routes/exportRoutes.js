// src/routes/exportRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');

// Import controller
let exportController;
try {
    exportController = require('../controllers/exportController');
} catch (error) {
    console.warn('⚠️ exportController not found, creating placeholder');
    exportController = {
        exportExcel: (req, res) => res.json({ success: true, message: 'Export placeholder' }),
        exportTemplate: (req, res) => res.json({ success: true, message: 'Template' })
    };
}

router.get('/excel', authenticate, exportController.exportExcel);
router.get('/template', authenticate, exportController.exportTemplate);

module.exports = router;