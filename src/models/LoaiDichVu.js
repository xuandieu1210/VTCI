// src/models/LoaiDichVu.js
const pool = require('../config/database');

class LoaiDichVu {
    static async getAll({ search = '', trang_thai = null, page = 1, limit = 20 }) {
        const safePage = Number(page) > 0 ? Number(page) : 1;
        const safeLimit = Number(limit) > 0 ? Number(limit) : 20;
        const offset = (safePage - 1) * safeLimit;
        let sql = 'SELECT * FROM loai_dich_vu WHERE 1=1';
        const params = [];

        if (search) {
            sql += " AND (ten_dich_vu ILIKE ? OR ma_dich_vu ILIKE ?)";
            params.push("%" + search + "%", "%" + search + "%");
        }
        if (trang_thai) {
            sql += " AND trang_thai = ?";
            params.push(trang_thai);
        }

        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countResult] = await pool.query(countSql, params);
        const total = countResult[0].total;

        sql += " ORDER BY ten_dich_vu LIMIT ? OFFSET ?";
        params.push(safeLimit, offset);
        const [rows] = await pool.query(sql, params);

        return { data: rows, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
    }

    static async getById(id) {
        const sql = 'SELECT * FROM loai_dich_vu WHERE id = ?';
        const [rows] = await pool.query(sql, [id]);
        return rows[0];
    }

    static async create(data) {
        const { ma_dich_vu, ten_dich_vu, loai_hinh, mo_ta, goi_cuoc_mac_dinh } = data;
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM loai_dich_vu WHERE ma_dich_vu = ?', [ma_dich_vu]);
        if (dupCheck[0].count > 0) throw new Error('Ma dich vu da ton tai');
        const sql = `INSERT INTO loai_dich_vu (ma_dich_vu, ten_dich_vu, loai_hinh, mo_ta, goi_cuoc_mac_dinh) VALUES (?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [ma_dich_vu, ten_dich_vu, loai_hinh, mo_ta, goi_cuoc_mac_dinh]);
        return result.insertId;
    }

    static async update(id, data) {
        const { ma_dich_vu, ten_dich_vu, loai_hinh, mo_ta, goi_cuoc_mac_dinh, trang_thai } = data;
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM loai_dich_vu WHERE ma_dich_vu = ? AND id != ?', [ma_dich_vu, id]);
        if (dupCheck[0].count > 0) throw new Error('Ma dich vu da ton tai');
        const sql = `UPDATE loai_dich_vu SET ma_dich_vu = ?, ten_dich_vu = ?, loai_hinh = ?, mo_ta = ?, goi_cuoc_mac_dinh = ?, trang_thai = ? WHERE id = ?`;
        const [result] = await pool.query(sql, [ma_dich_vu, ten_dich_vu, loai_hinh, mo_ta, goi_cuoc_mac_dinh, trang_thai, id]);
        return result.affectedRows;
    }

    static async deactivate(id) {
        const sql = "UPDATE loai_dich_vu SET trang_thai = 'ngung_hoat_dong' WHERE id = ?";
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }

    static async deletePermanent(id) {
        const [check] = await pool.query('SELECT COUNT(*) as count FROM thue_bao_dich_vu WHERE loai_dich_vu_id = ?', [id]);
        if (Number(check[0]?.count || 0) > 0) {
            throw new Error('Khong the xoa vinh vien loai dich vu vi da co thue bao dang su dung');
        }

        const sql = 'DELETE FROM loai_dich_vu WHERE id = ?';
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }

    static async getAllActive() {
        const sql = "SELECT * FROM loai_dich_vu WHERE trang_thai = 'dang_hoat_dong' ORDER BY ten_dich_vu";
        const [rows] = await pool.query(sql);
        return rows;
    }
}

module.exports = LoaiDichVu;