// src/config/multer.js
const multer = require('multer');
const path = require('path');
const { ensureDirectoryExists, generateSafeFileName, getHoSoUploadDir } = require('../utils/fileHelper');

const hoSoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = getHoSoUploadDir();
        ensureDirectoryExists(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const safeName = generateSafeFileName(file.originalname);
        cb(null, 'hoso-' + safeName);
    }
});

const importStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/import_temp';
        ensureDirectoryExists(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const safeName = generateSafeFileName(file.originalname);
        cb(null, 'import-' + safeName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Dinh dang file khong duoc ho tro'), false);
    }
};

exports.uploadHoSo = multer({
    storage: hoSoStorage,
    fileFilter: fileFilter,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 }
});

exports.uploadImport = multer({
    storage: importStorage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Chi chap nhan file Excel'), false);
        }
    },
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 }
});