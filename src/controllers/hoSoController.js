// src/controllers/hoSoController.js
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const sanitizeHtml = require('sanitize-html');
const XLSX = require('xlsx');
const { getStoredHoSoPath, resolveHoSoPath } = require('../utils/fileHelper');
const { invalidateReview } = require('../utils/documentStatus');

const DOCUMENT_TYPE_MAP = {
    giay_chung_nhan_ho_ngheo_can_ngheo: 'Giấy chứng nhận hộ nghèo/cận nghèo',
    don_dang_ky_su_dung: 'Đơn đăng ký sử dụng',
    hop_dong_cung_cap_dv: 'Hợp đồng cung cấp DV',
    giay_cccd: 'Giấy CCCD',
    giay_cam_ket: 'Giấy cam kết'
};

const normalizeLoaiHoSo = (value) => {
    if (!value) return '';
    return String(value).trim().toLowerCase().replace(/\s+/g, '_');
};

const normalizeNamHoSo = (value) => {
    const year = Number(value ?? new Date().getFullYear());
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return new Date().getFullYear();
    }
    return year;
};

const isAllowedDocumentType = (value) => {
    const normalized = normalizeLoaiHoSo(value);
    return Boolean(normalized && Object.prototype.hasOwnProperty.call(DOCUMENT_TYPE_MAP, normalized));
};

exports.getAll = async (req, res) => {
    try {
        const { ho_gia_dinh_id } = req.query;
        let sql = 'SELECT * FROM ho_so_dinh_kem WHERE 1=1';
        const params = [];
        if (ho_gia_dinh_id) { sql += " AND ho_gia_dinh_id = ?"; params.push(ho_gia_dinh_id); }
        sql += ' ORDER BY created_at DESC';
        const [rows] = await pool.query(sql, params);
        res.json({ success: true, data: rows || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM ho_so_dinh_kem WHERE id = ?', [req.params.id]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay ho so' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.upload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Vui long chon file' });
        }

        const { ho_gia_dinh_id, thanh_vien_id, loai_ho_so, ngay_het_han, mo_ta, nam_ho_so } = req.body;
        const normalizedType = normalizeLoaiHoSo(loai_ho_so);
        const normalizedYear = normalizeNamHoSo(nam_ho_so);

        if (!ho_gia_dinh_id) {
            return res.status(400).json({ success: false, message: 'Thiếu mã hộ gia đình' });
        }
        if (!isAllowedDocumentType(normalizedType)) {
            return res.status(400).json({ success: false, message: 'Loại hồ sơ không hợp lệ' });
        }

        // Ensure atomic delete + insert to avoid duplicates from concurrent uploads
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query('SELECT id FROM ho_gia_dinh WHERE id = ? FOR UPDATE', [ho_gia_dinh_id]);

            const [existingRows] = await conn.query(
                'SELECT * FROM ho_so_dinh_kem WHERE ho_gia_dinh_id = ? AND loai_ho_so = ? AND nam_ho_so = ? ORDER BY created_at DESC',
                [ho_gia_dinh_id, normalizedType, normalizedYear]
            );

            if (existingRows && existingRows.length > 0) {
                await conn.query('DELETE FROM ho_so_dinh_kem WHERE ho_gia_dinh_id = ? AND loai_ho_so = ? AND nam_ho_so = ?', [ho_gia_dinh_id, normalizedType, normalizedYear]);
            }

            const sql = `
                INSERT INTO ho_so_dinh_kem 
                (ho_gia_dinh_id, thanh_vien_id, loai_ho_so, nam_ho_so, ten_file, duong_dan_file, 
                 dung_luong, dinh_dang, ngay_het_han, nguoi_tai_len, mo_ta)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const [result] = await conn.query(sql, [
                ho_gia_dinh_id, thanh_vien_id || null, normalizedType, normalizedYear, req.file.filename,
                getStoredHoSoPath(req.file.filename), req.file.size, path.extname(req.file.originalname).substring(1),
                ngay_het_han || null, req.user?.username || 'system', mo_ta || null
            ]);

            await invalidateReview(conn, ho_gia_dinh_id, [{ loai_ho_so: normalizedType, nam_ho_so: normalizedYear }]);

            await conn.commit();
            for (const oldDoc of existingRows) {
                const oldFilePath = resolveHoSoPath(oldDoc.duong_dan_file);
                if (oldFilePath && fs.existsSync(oldFilePath)) {
                    try { fs.unlinkSync(oldFilePath); } catch (error) { console.warn('Could not remove replaced document:', error.message); }
                }
            }
            const [rows] = await pool.query('SELECT * FROM ho_so_dinh_kem WHERE id = ?', [result.insertId]);
            res.status(201).json({ success: true, data: rows[0] });
            return;
        } catch (err) {
            try { await conn.rollback(); } catch (e) {}
            throw err;
        } finally {
            conn.release();
        }
        const [rows] = await pool.query('SELECT * FROM ho_so_dinh_kem WHERE id = ?', [result.insertId]);
        res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.update = async (req, res) => {
    let conn;
    try {
        const { id } = req.params;
        const { loai_ho_so, ngay_het_han, trang_thai, mo_ta, nam_ho_so } = req.body;
        const normalizedType = normalizeLoaiHoSo(loai_ho_so);
        const normalizedYear = normalizeNamHoSo(nam_ho_so);
        if (!isAllowedDocumentType(normalizedType)) return res.status(400).json({ success: false, message: 'Loại hồ sơ không hợp lệ' });
        conn = await pool.getConnection();
        await conn.beginTransaction();
        const [previous] = await conn.query('SELECT * FROM ho_so_dinh_kem WHERE id = ? FOR UPDATE', [id]);
        if (!previous.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Khong tim thay ho so' });
        }
        await conn.query('SELECT id FROM ho_gia_dinh WHERE id = ? FOR UPDATE', [previous[0].ho_gia_dinh_id]);
        const sql = `UPDATE ho_so_dinh_kem SET loai_ho_so = ?, nam_ho_so = ?, ngay_het_han = ?, trang_thai = ?, mo_ta = ? WHERE id = ?`;
        await conn.query(sql, [normalizedType, normalizedYear, ngay_het_han, trang_thai, mo_ta, id]);
        await invalidateReview(conn, previous[0].ho_gia_dinh_id, [previous[0], { loai_ho_so: normalizedType, nam_ho_so: normalizedYear }]);
        const [rows] = await conn.query('SELECT * FROM ho_so_dinh_kem WHERE id = ?', [id]);
        await conn.commit();
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        res.status(400).json({ success: false, message: error.message });
    } finally {
        if (conn) conn.release();
    }
};

exports.delete = async (req, res) => {
    let conn;
    try {
        const { id } = req.params;
        conn = await pool.getConnection();
        await conn.beginTransaction();
        const [hoSo] = await conn.query('SELECT * FROM ho_so_dinh_kem WHERE id = ? FOR UPDATE', [id]);
        if (!hoSo.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Khong tim thay ho so' });
        }
        await conn.query('SELECT id FROM ho_gia_dinh WHERE id = ? FOR UPDATE', [hoSo[0].ho_gia_dinh_id]);
        await conn.query('DELETE FROM ho_so_dinh_kem WHERE id = ?', [id]);
        await invalidateReview(conn, hoSo[0].ho_gia_dinh_id, [hoSo[0]]);
        await conn.commit();
        const filePath = resolveHoSoPath(hoSo[0].duong_dan_file);
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (error) { console.warn('Could not remove document:', error.message); }
        }
        res.json({ success: true, message: 'Xoa ho so thanh cong' });
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (conn) conn.release();
    }
};

exports.download = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM ho_so_dinh_kem WHERE id = ?', [req.params.id]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay ho so' });
        }
        const hoSo = rows[0];
        const filePath = resolveHoSoPath(hoSo.duong_dan_file);
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'File khong ton tai' });
        }
        res.download(filePath, hoSo.ten_file);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.preview = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM ho_so_dinh_kem WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ' });
        const filePath = resolveHoSoPath(rows[0].duong_dan_file);
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'Tệp hồ sơ không tồn tại' });
        }

        const extension = path.extname(filePath).toLowerCase();
        res.set('Cache-Control', 'no-store');
        if (['.pdf', '.jpg', '.jpeg', '.png'].includes(extension)) {
            return res.type(extension).sendFile(filePath);
        }

        let content;
        if (extension === '.docx') {
            content = (await mammoth.convertToHtml({ path: filePath })).value;
        } else if (['.xlsx', '.xls', '.csv'].includes(extension)) {
            const workbook = XLSX.readFile(filePath);
            content = workbook.SheetNames.map(name => {
                const title = sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} });
                return `<h2>${title}</h2>${XLSX.utils.sheet_to_html(workbook.Sheets[name])}`;
            }).join('');
        } else {
            return res.status(415).json({ success: false, message: 'Định dạng này không hỗ trợ xem trực tiếp' });
        }

        const safeContent = sanitizeHtml(content, {
            allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div', 'sup', 'sub'],
            allowedAttributes: { img: ['src', 'alt'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] },
            allowedSchemes: ['data'],
            allowedSchemesByTag: { img: ['data'] }
        });
        res.set('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'");
        res.type('html').send(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:24px;overflow-wrap:anywhere}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #ccc;padding:4px}img{max-width:100%;height:auto}</style></head><body>${safeContent}</body></html>`);
    } catch (error) {
        console.error('Document preview failed:', error.message);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Không thể xem tệp hồ sơ' });
    }
};

exports.checkExpired = async (req, res) => {
    try {
        const [sapHetHan] = await pool.query(`
            SELECT * FROM ho_so_dinh_kem
            WHERE ngay_het_han IS NOT NULL
            AND ngay_het_han BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        `);
        const [daHetHan] = await pool.query(`
            SELECT * FROM ho_so_dinh_kem
            WHERE ngay_het_han IS NOT NULL AND ngay_het_han < CURRENT_DATE
        `);
        res.json({
            success: true,
            data: { sapHetHan: sapHetHan || [], daHetHan: daHetHan || [] }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};