// src/models/VNPTKhuVuc.js
const pool = require('../config/database');

class VNPTKhuVuc {
    static async getAll({ search = '', trang_thai = null, page = 1, limit = 20 }) {
        const safePage = Number(page) > 0 ? Number(page) : 1;
        const safeLimit = Number(limit) > 0 ? Number(limit) : 20;
        const offset = (safePage - 1) * safeLimit;
        let sql = 'SELECT * FROM vnpt_khu_vuc WHERE 1=1';
        const params = [];

        if (search) {
            sql += " AND (ten_khu_vuc ILIKE ? OR ma_khu_vuc ILIKE ?)";
            params.push("%" + search + "%", "%" + search + "%");
        }
        if (trang_thai) {
            sql += " AND trang_thai = ?";
            params.push(trang_thai);
        }

        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countResult] = await pool.query(countSql, params);
        const total = Number(countResult[0]?.total || 0);

        sql += ' ORDER BY ten_khu_vuc LIMIT ? OFFSET ?';
        params.push(safeLimit, offset);
        const [rows] = await pool.query(sql, params);
        return {
            data: rows,
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit)
            }
        };
    }

    static async getById(id) {
        const sql = 'SELECT * FROM vnpt_khu_vuc WHERE id = ?';
        const [rows] = await pool.query(sql, [id]);
        return rows[0];
    }

    static async create(data) {
        const { ma_khu_vuc, ten_khu_vuc, mo_ta } = data;
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM vnpt_khu_vuc WHERE ma_khu_vuc = ?', [ma_khu_vuc]);
        if (dupCheck[0].count > 0) throw new Error('Ma khu vuc da ton tai');
        const sql = 'INSERT INTO vnpt_khu_vuc (ma_khu_vuc, ten_khu_vuc, mo_ta) VALUES (?, ?, ?)';
        const [result] = await pool.query(sql, [ma_khu_vuc, ten_khu_vuc, mo_ta]);
        return result.insertId;
    }

    static async update(id, data) {
        const { ma_khu_vuc, ten_khu_vuc, mo_ta, trang_thai } = data;
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM vnpt_khu_vuc WHERE ma_khu_vuc = ? AND id != ?', [ma_khu_vuc, id]);
        if (dupCheck[0].count > 0) throw new Error('Ma khu vuc da ton tai');
        const sql = 'UPDATE vnpt_khu_vuc SET ma_khu_vuc = ?, ten_khu_vuc = ?, mo_ta = ?, trang_thai = ? WHERE id = ?';
        const [result] = await pool.query(sql, [ma_khu_vuc, ten_khu_vuc, mo_ta, trang_thai, id]);
        return result.affectedRows;
    }

    static async deactivate(id) {
        const sql = "UPDATE vnpt_khu_vuc SET trang_thai = 'ngung_hoat_dong' WHERE id = ?";
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }

    static async deletePermanent(id) {
        const [xaCheck] = await pool.query('SELECT COUNT(*) as count FROM danh_muc_xa WHERE vnpt_khu_vuc_id = ?', [id]);
        if (Number(xaCheck[0]?.count || 0) > 0) {
            throw new Error('Khong the xoa vinh vien khu vuc vi con xa dang su dung');
        }

        const [hoCheck] = await pool.query('SELECT COUNT(*) as count FROM ho_gia_dinh WHERE vnpt_khu_vuc_id = ?', [id]);
        if (Number(hoCheck[0]?.count || 0) > 0) {
            throw new Error('Khong the xoa vinh vien khu vuc vi con ho gia dinh dang su dung');
        }

        const [userCheck] = await pool.query('SELECT COUNT(*) as count FROM users WHERE vnpt_khu_vuc_id = ?', [id]);
        if (Number(userCheck[0]?.count || 0) > 0) {
            throw new Error('Khong the xoa vinh vien khu vuc vi con nguoi dung dang su dung');
        }

        const sql = 'DELETE FROM vnpt_khu_vuc WHERE id = ?';
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }
}

module.exports = VNPTKhuVuc;