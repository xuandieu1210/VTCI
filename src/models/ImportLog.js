// src/models/ImportLog.js
const pool = require('../config/database');

class ImportLog {
    static async create(data) {
        const { ten_file, loai_import, tong_so_dong, so_luong_thanh_cong, so_luong_that_bai, trang_thai, loi_chi_tiet, duong_dan_file_tam, nguoi_import_id } = data;
        const sql = `INSERT INTO import_log (ten_file, loai_import, tong_so_dong, so_luong_thanh_cong, so_luong_that_bai, trang_thai, loi_chi_tiet, duong_dan_file_tam, nguoi_import_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [ten_file, loai_import || 'full', tong_so_dong || 0, so_luong_thanh_cong || 0, so_luong_that_bai || 0, trang_thai || 'dang_xu_ly', JSON.stringify(loi_chi_tiet || []), duong_dan_file_tam, nguoi_import_id]);
        return result.insertId;
    }

    static async getAll({ page = 1, limit = 20 }) {
        const offset = (page - 1) * limit;
        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM import_log');
        const total = countResult[0].total;
        const sql = 'SELECT * FROM import_log ORDER BY created_at DESC LIMIT ? OFFSET ?';
        const [rows] = await pool.query(sql, [limit, offset]);
        return { data: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    static async getById(id) {
        const sql = 'SELECT * FROM import_log WHERE id = ?';
        const [rows] = await pool.query(sql, [id]);
        return rows[0];
    }
}

module.exports = ImportLog;