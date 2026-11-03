// src/controllers/hoSoController.js
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');
const { getStoredHoSoPath, resolveHoSoPath } = require('../utils/fileHelper');

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

            const [existingRows] = await conn.query(
                'SELECT * FROM ho_so_dinh_kem WHERE ho_gia_dinh_id = ? AND loai_ho_so = ? AND nam_ho_so = ? ORDER BY created_at DESC',
                [ho_gia_dinh_id, normalizedType, normalizedYear]
            );

            if (existingRows && existingRows.length > 0) {
                for (const oldDoc of existingRows) {
                    const oldFilePath = resolveHoSoPath(oldDoc.duong_dan_file);
                    if (oldFilePath && fs.existsSync(oldFilePath)) {
                        try { fs.unlinkSync(oldFilePath); } catch (e) {}
                    }
                }
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

            await conn.query(`
                UPDATE ho_gia_dinh
                SET trang_thai_ho_so = 'can_bo_sung', ly_do_tu_choi = NULL, updated_at = NOW()
                WHERE id = ? AND trang_thai_ho_so IN ('day_du', 'tu_choi')
            `, [ho_gia_dinh_id]);

            await conn.commit();
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
    try {
        const { id } = req.params;
        const { loai_ho_so, ngay_het_han, trang_thai, mo_ta, nam_ho_so } = req.body;
        const normalizedType = normalizeLoaiHoSo(loai_ho_so);
        const normalizedYear = normalizeNamHoSo(nam_ho_so);
        const sql = `UPDATE ho_so_dinh_kem SET loai_ho_so = ?, nam_ho_so = ?, ngay_het_han = ?, trang_thai = ?, mo_ta = ? WHERE id = ?`;
        const [result] = await pool.query(sql, [normalizedType, normalizedYear, ngay_het_han, trang_thai, mo_ta, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay ho so' });
        }
        const [rows] = await pool.query('SELECT * FROM ho_so_dinh_kem WHERE id = ?', [id]);
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const [hoSo] = await pool.query('SELECT * FROM ho_so_dinh_kem WHERE id = ?', [id]);
        if (hoSo && hoSo.length > 0 && hoSo[0].duong_dan_file) {
            const filePath = resolveHoSoPath(hoSo[0].duong_dan_file);
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        const [result] = await pool.query('DELETE FROM ho_so_dinh_kem WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay ho so' });
        }
        res.json({ success: true, message: 'Xoa ho so thanh cong' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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

exports.checkExpired = async (req, res) => {
    try {
        const [sapHetHan] = await pool.query(`
            SELECT * FROM ho_so_dinh_kem
            WHERE ngay_het_han IS NOT NULL
            AND ngay_het_han BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        `);
        const [daHetHan] = await pool.query(`
            SELECT * FROM ho_so_dinh_kem
            WHERE ngay_het_han IS NOT NULL AND ngay_het_han < CURDATE()
        `);
        res.json({
            success: true,
            data: { sapHetHan: sapHetHan || [], daHetHan: daHetHan || [] }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};