// src/models/DanhMucXa.js
const pool = require('../config/database');

class DanhMucXa {
    static async getAll({ search = '', searchCu = '', vnpt_khu_vuc_id = null, trang_thai = null, page = 1, limit = 20 }) {
        const safePage = Number(page) > 0 ? Number(page) : 1;
        const safeLimit = Number(limit) > 0 ? Number(limit) : 20;
        const offset = (safePage - 1) * safeLimit;
        let sql = `
            SELECT x.*, v.ten_khu_vuc 
            FROM danh_muc_xa x
            LEFT JOIN vnpt_khu_vuc v ON x.vnpt_khu_vuc_id = v.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += " AND x.ten_xa LIKE ?";
            params.push("%" + search + "%");
        }
        if (searchCu) {
            sql += " AND x.ten_xa_cu LIKE ?";
            params.push("%" + searchCu + "%");
        }
        if (vnpt_khu_vuc_id) {
            sql += " AND x.vnpt_khu_vuc_id = ?";
            params.push(vnpt_khu_vuc_id);
        }
        if (trang_thai) {
            sql += " AND x.trang_thai = ?";
            params.push(trang_thai);
        }

        const countSql = sql.replace(/SELECT[\s\S]*?FROM\s+/i, 'SELECT COUNT(*) as total FROM ');
        const [countResult] = await pool.query(countSql, params);
        const total = Number(countResult[0]?.total || 0);

        sql += " ORDER BY x.ten_xa LIMIT ? OFFSET ?";
        params.push(safeLimit, offset);
        const [rows] = await pool.query(sql, params);

        return { data: rows, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
    }

    static async getById(id) {
        const sql = `
            SELECT x.*, v.ten_khu_vuc 
            FROM danh_muc_xa x
            LEFT JOIN vnpt_khu_vuc v ON x.vnpt_khu_vuc_id = v.id
            WHERE x.id = ?
        `;
        const [rows] = await pool.query(sql, [id]);
        return rows[0];
    }

    static async create(data) {
        const cleanValue = (value) => (value === '' || value === undefined || value === null ? null : value);
        const { ma_xa, ten_xa, ten_xa_cu, vnpt_khu_vuc_id, cap_hanh_chinh, ma_hanh_chinh, ghi_chu } = data;
        if (!ma_xa || !ten_xa) throw new Error('Ma xa va ten xa la bat buoc');
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM danh_muc_xa WHERE ma_xa = ? OR ten_xa = ?', [ma_xa, ten_xa]);
        if (dupCheck[0].count > 0) throw new Error('Ma xa hoac ten xa da ton tai');
        const sql = `INSERT INTO danh_muc_xa (ma_xa, ten_xa, ten_xa_cu, vnpt_khu_vuc_id, cap_hanh_chinh, ma_hanh_chinh, ghi_chu) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [ma_xa, ten_xa, cleanValue(ten_xa_cu), cleanValue(vnpt_khu_vuc_id), cap_hanh_chinh || 'xa', cleanValue(ma_hanh_chinh), cleanValue(ghi_chu)]);
        return result.insertId;
    }

    static async update(id, data) {
        const cleanValue = (value) => (value === '' || value === undefined || value === null ? null : value);
        const { ma_xa, ten_xa, ten_xa_cu, vnpt_khu_vuc_id, cap_hanh_chinh, ma_hanh_chinh, trang_thai, ghi_chu } = data;
        if (!ma_xa || !ten_xa) throw new Error('Ma xa va ten xa la bat buoc');
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM danh_muc_xa WHERE (ma_xa = ? OR ten_xa = ?) AND id != ?', [ma_xa, ten_xa, id]);
        if (dupCheck[0].count > 0) throw new Error('Ma xa hoac ten xa da ton tai');
        const sql = `UPDATE danh_muc_xa SET ma_xa = ?, ten_xa = ?, ten_xa_cu = ?, vnpt_khu_vuc_id = ?, cap_hanh_chinh = ?, ma_hanh_chinh = ?, trang_thai = ?, ghi_chu = ? WHERE id = ?`;
        const [result] = await pool.query(sql, [ma_xa, ten_xa, cleanValue(ten_xa_cu), cleanValue(vnpt_khu_vuc_id), cap_hanh_chinh || 'xa', cleanValue(ma_hanh_chinh), trang_thai || 'dang_hoat_dong', cleanValue(ghi_chu), id]);
        return result.affectedRows;
    }

    static async deactivate(id) {
        const sql = 'UPDATE danh_muc_xa SET trang_thai = "ngung_hoat_dong" WHERE id = ?';
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }

    static async deletePermanent(id) {
        const [hoCheck] = await pool.query('SELECT COUNT(*) as count FROM ho_gia_dinh WHERE xa_id = ?', [id]);
        if (Number(hoCheck[0]?.count || 0) > 0) {
            throw new Error('Khong the xoa vinh vien xa vi con ho gia dinh dang su dung');
        }

        const sql = 'DELETE FROM danh_muc_xa WHERE id = ?';
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }

    static async getAllActive() {
        const sql = 'SELECT * FROM danh_muc_xa WHERE trang_thai = "dang_hoat_dong" ORDER BY ten_xa';
        const [rows] = await pool.query(sql);
        return rows;
    }
}

module.exports = DanhMucXa;