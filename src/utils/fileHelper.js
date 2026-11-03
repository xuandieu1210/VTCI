// src/utils/fileHelper.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_ROOT = path.resolve(__dirname, '../..');
const UPLOADS_ROOT = path.resolve(APP_ROOT, process.env.UPLOADS_DIR || 'uploads');

function getHoSoUploadDir() {
    return path.join(UPLOADS_ROOT, 'ho_so');
}

function getStoredHoSoPath(filename) {
    return path.posix.join('uploads', 'ho_so', path.basename(filename));
}

function resolveHoSoPath(storedPath) {
    if (!storedPath) return null;

    const normalized = String(storedPath).replace(/\\/g, '/');
    const uploadsMarker = normalized.lastIndexOf('/uploads/ho_so/');
    let relativePath = normalized;

    if (normalized.startsWith('uploads/')) {
        relativePath = normalized.slice('uploads/'.length);
    } else if (uploadsMarker >= 0) {
        relativePath = normalized.slice(uploadsMarker + '/uploads/'.length);
    } else if (path.isAbsolute(storedPath) || /^[A-Za-z]:\//.test(normalized)) {
        return storedPath;
    }

    const resolved = path.resolve(UPLOADS_ROOT, relativePath);
    const relativeToUploads = path.relative(UPLOADS_ROOT, resolved);
    if (relativeToUploads.startsWith('..') || path.isAbsolute(relativeToUploads)) return null;
    return resolved;
}

function generateSafeFileName(originalName) {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return timestamp + '-' + random + ext;
}

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        return 0;
    }
}

function safeDeleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting file:', error);
        return false;
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

function getMimeType(filePath) {
    const ext = getFileExtension(filePath);
    const mimeTypes = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'csv': 'text/csv',
        'txt': 'text/plain',
        'zip': 'application/zip'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

function copyFile(source, destination) {
    ensureDirectoryExists(path.dirname(destination));
    fs.copyFileSync(source, destination);
    return destination;
}

function readFileAsBuffer(filePath) {
    return fs.readFileSync(filePath);
}

function writeFileFromBuffer(buffer, filePath) {
    ensureDirectoryExists(path.dirname(filePath));
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

function listFiles(dirPath, pattern = null) {
    try {
        const files = fs.readdirSync(dirPath);
        if (pattern) {
            const regex = new RegExp(pattern);
            return files.filter(file => regex.test(file));
        }
        return files;
    } catch (error) {
        return [];
    }
}

module.exports = {
    getHoSoUploadDir,
    getStoredHoSoPath,
    resolveHoSoPath,
    generateSafeFileName,
    ensureDirectoryExists,
    getFileSize,
    safeDeleteFile,
    formatFileSize,
    getFileExtension,
    getMimeType,
    copyFile,
    readFileAsBuffer,
    writeFileFromBuffer,
    listFiles
};