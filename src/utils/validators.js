// src/utils/validators.js
const Joi = require('joi');

const hoGiaDinhSchema = Joi.object({
    ten_chu_ho: Joi.string().required().min(2).max(100),
    so_cmnd: Joi.string().required().pattern(/^[0-9]{9,12}$/).max(12),
    ngay_sinh: Joi.date().allow(null),
    gioi_tinh: Joi.string().valid('nam', 'nu', 'khac').allow(null),
    dia_chi_chi_tiet: Joi.string().max(255).allow(null),
    xa_id: Joi.number().required(),
    loai_doi_tuong_id: Joi.number().allow(null),
    vnpt_khu_vuc_id: Joi.number().allow(null),
    so_thue_bao_chinh: Joi.string().allow(null),
    ghi_chu: Joi.string().allow(null)
});

const thanhVienSchema = Joi.object({
    ho_gia_dinh_id: Joi.number().required(),
    ho_ten: Joi.string().required().min(2).max(100),
    so_cmnd: Joi.string().pattern(/^[0-9]{9,12}$/).max(12).allow(null),
    ngay_sinh: Joi.date().allow(null),
    gioi_tinh: Joi.string().valid('nam', 'nu', 'khac').allow(null),
    quan_he_chu_ho: Joi.string().max(50).allow(null),
    so_dien_thoai: Joi.string().pattern(/^[0-9]{10,11}$/).allow(null),
    email: Joi.string().email().allow(null),
    nghe_nghiep: Joi.string().max(100).allow(null)
});

const thueBaoSchema = Joi.object({
    ho_gia_dinh_id: Joi.number().required(),
    thanh_vien_id: Joi.number().allow(null),
    loai_dich_vu_id: Joi.number().required(),
    so_thue_bao: Joi.string().required().pattern(/^[0-9]{10,11}$/),
    ten_chu_thue_bao: Joi.string().max(100).allow(null),
    cmnd_chu_thue_bao: Joi.string().pattern(/^[0-9]{9,12}$/).max(12).allow(null),
    goi_cuoc_dang_ky: Joi.string().max(50).allow(null),
    ngay_dang_ky: Joi.date().allow(null),
    ngay_kich_hoat: Joi.date().allow(null),
    ngay_het_han: Joi.date().allow(null),
    trang_thai_dich_vu: Joi.string().valid('dang_hoat_dong', 'tam_ngung', 'da_huy', 'cho_kich_hoat').allow(null)
});

const userSchema = Joi.object({
    username: Joi.string().required().min(3).max(50).alphanum(),
    password: Joi.string().required().min(6),
    ho_ten: Joi.string().required().min(2).max(100),
    email: Joi.string().email().required(),
    so_dien_thoai: Joi.string().pattern(/^[0-9]{10,11}$/).allow(null),
    vai_tro: Joi.string().valid('admin', 'manager', 'staff', 'vnpt_khu_vuc').default('staff'),
    xa_quan_ly_id: Joi.number().allow(null),
    vnpt_khu_vuc_id: Joi.number().allow(null),
    quyen_chuc_nang: Joi.array().items(Joi.string()).default([])
});

function validateImportData(row) {
    const errors = [];
    if (!row['Tên chủ hộ'] || row['Tên chủ hộ'].trim() === '') {
        errors.push('Thieu ten chu ho');
    }
    if (!row['Số CMND/ CCCD'] || row['Số CMND/ CCCD'].trim() === '') {
        errors.push('Thieu so CMND/CCCD');
    } else {
        const cmnd = String(row['Số CMND/ CCCD']).trim();
        if (!/^[0-9]{9,12}$/.test(cmnd)) {
            errors.push('So CMND/CCCD khong hop le (phai la 9-12 chu so)');
        }
    }
    if (!row['Tên xã'] || row['Tên xã'].trim() === '') {
        errors.push('Thieu ten xa');
    }
    return errors;
}

function formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
        return new Date((value - 25569) * 86400 * 1000);
    }
    if (typeof value === 'string') {
        const formats = [
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/
        ];
        for (const regex of formats) {
            const match = value.match(regex);
            if (match) {
                const [, d, m, y] = match;
                return new Date(y, m - 1, d);
            }
        }
        return new Date(value);
    }
    return null;
}

function generateCode(prefix, length = 6) {
    const random = Math.random().toString(36).substring(2, length + 2).toUpperCase();
    return prefix + '_' + random;
}

function isValidFileType(filename, allowedTypes) {
    const ext = filename.split('.').pop().toLowerCase();
    return allowedTypes.includes(ext);
}

module.exports = {
    hoGiaDinhSchema,
    thanhVienSchema,
    thueBaoSchema,
    userSchema,
    validateImportData,
    formatDate,
    parseDate,
    generateCode,
    isValidFileType
};