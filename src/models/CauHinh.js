// src/models/CauHinh.js
const pool = require('../config/database');

class CauHinh {
    static async getAll({ nhom = null, page = 1, limit = 50 }) {
        const offset = (page - 1) * limit;
        let sql = 'SELECT * FROM cau_hinh_he_thong WHERE 1=1';
        const params = [];

        if (nhom) { sql += " AND nhom = ?"; params.push(nhom); }

        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countResult] = await pool.query(countSql, params);
        const total = countResult[0].total;

        sql += ' ORDER BY nhom, ten_cau_hinh LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [rows] = await pool.query(sql, params);

        return { data: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    static async getByMa(ma_cau_hinh) {
        const sql = 'SELECT * FROM cau_hinh_he_thong WHERE ma_cau_hinh = ?';
        const [rows] = await pool.query(sql, [ma_cau_hinh]);
        return rows[0];
    }

    static async getValue(ma_cau_hinh) {
        const config = await this.getByMa(ma_cau_hinh);
        if (!config) return null;
        try { return JSON.parse(config.gia_tri); } catch { return config.gia_tri; }
    }

    static async create(data) {
        const { ma_cau_hinh, ten_cau_hinh, gia_tri, loai_du_lieu, mo_ta, nhom } = data;
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM cau_hinh_he_thong WHERE ma_cau_hinh = ?', [ma_cau_hinh]);
        if (dupCheck[0].count > 0) throw new Error('Ma cau hinh da ton tai');
        const sql = `INSERT INTO cau_hinh_he_thong (ma_cau_hinh, ten_cau_hinh, gia_tri, loai_du_lieu, mo_ta, nhom) VALUES (?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [ma_cau_hinh, ten_cau_hinh, gia_tri, loai_du_lieu || 'text', mo_ta, nhom]);
        return result.insertId;
    }

    static async update(id, data) {
        const { ma_cau_hinh, ten_cau_hinh, gia_tri, loai_du_lieu, mo_ta, nhom } = data;
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM cau_hinh_he_thong WHERE ma_cau_hinh = ? AND id != ?', [ma_cau_hinh, id]);
        if (dupCheck[0].count > 0) throw new Error('Ma cau hinh da ton tai');
        const sql = `UPDATE cau_hinh_he_thong SET ma_cau_hinh = ?, ten_cau_hinh = ?, gia_tri = ?, loai_du_lieu = ?, mo_ta = ?, nhom = ? WHERE id = ?`;
        const [result] = await pool.query(sql, [ma_cau_hinh, ten_cau_hinh, gia_tri, loai_du_lieu, mo_ta, nhom, id]);
        return result.affectedRows;
    }

    static async delete(id) {
        const sql = 'DELETE FROM cau_hinh_he_thong WHERE id = ?';
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }
}

module.exports = CauHinh;