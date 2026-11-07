// src/models/LoaiDoiTuong.js
const pool = require('../config/database');

class LoaiDoiTuong {
    static async getAll({ search = '', trang_thai = null, page = 1, limit = 20 }) {
        const safePage = Number(page) > 0 ? Number(page) : 1;
        const safeLimit = Number(limit) > 0 ? Number(limit) : 20;
        const offset = (safePage - 1) * safeLimit;
        let sql = 'SELECT * FROM loai_doi_tuong WHERE 1=1';
        const params = [];

        if (search) {
            sql += " AND (ten_loai ILIKE ? OR ma_loai ILIKE ?)";
            params.push("%" + search + "%", "%" + search + "%");
        }
        if (trang_thai) {
            sql += " AND trang_thai = ?";
            params.push(trang_thai);
        }

        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countResult] = await pool.query(countSql, params);
        const total = countResult[0].total;

        sql += " ORDER BY thu_tu_uu_tien, ten_loai LIMIT ? OFFSET ?";
        params.push(safeLimit, offset);
        const [rows] = await pool.query(sql, params);

        return { data: rows, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
    }

    static async getById(id) {
        const sql = 'SELECT * FROM loai_doi_tuong WHERE id = ?';
        const [rows] = await pool.query(sql, [id]);
        return rows[0];
    }

    static async create(data) {
        const { ma_loai, ten_loai, mo_ta, thu_tu_uu_tien } = data;
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM loai_doi_tuong WHERE ma_loai = ? OR ten_loai = ?', [ma_loai, ten_loai]);
        if (dupCheck[0].count > 0) throw new Error('Ma loai hoac ten loai da ton tai');
        const sql = `INSERT INTO loai_doi_tuong (ma_loai, ten_loai, mo_ta, thu_tu_uu_tien) VALUES (?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [ma_loai, ten_loai, mo_ta, thu_tu_uu_tien || 0]);
        return result.insertId;
    }

    static async update(id, data) {
        const { ma_loai, ten_loai, mo_ta, thu_tu_uu_tien, trang_thai } = data;
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM loai_doi_tuong WHERE (ma_loai = ? OR ten_loai = ?) AND id != ?', [ma_loai, ten_loai, id]);
        if (dupCheck[0].count > 0) throw new Error('Ma loai hoac ten loai da ton tai');
        const sql = `UPDATE loai_doi_tuong SET ma_loai = ?, ten_loai = ?, mo_ta = ?, thu_tu_uu_tien = ?, trang_thai = ? WHERE id = ?`;
        const [result] = await pool.query(sql, [ma_loai, ten_loai, mo_ta, thu_tu_uu_tien, trang_thai, id]);
        return result.affectedRows;
    }

    static async deactivate(id) {
        const sql = "UPDATE loai_doi_tuong SET trang_thai = 'ngung_hoat_dong' WHERE id = ?";
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }

    static async deletePermanent(id) {
        const [check] = await pool.query('SELECT COUNT(*) as count FROM ho_gia_dinh WHERE loai_doi_tuong_id = ?', [id]);
        if (Number(check[0]?.count || 0) > 0) {
            throw new Error('Khong the xoa vinh vien loai doi tuong vi con ho gia dinh dang su dung');
        }

        const sql = 'DELETE FROM loai_doi_tuong WHERE id = ?';
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }

    static async getAllActive() {
        const sql = "SELECT * FROM loai_doi_tuong WHERE trang_thai = 'dang_hoat_dong' ORDER BY thu_tu_uu_tien";
        const [rows] = await pool.query(sql);
        return rows;
    }
}

module.exports = LoaiDoiTuong;