// src/models/CanhBao.js
const pool = require('../config/database');

class CanhBao {
    static async getAll({ loai_canh_bao = null, trang_thai = null, page = 1, limit = 20 }) {
        const offset = (page - 1) * limit;
        let sql = 'SELECT * FROM canh_bao WHERE 1=1';
        const params = [];

        if (loai_canh_bao) { sql += " AND loai_canh_bao = ?"; params.push(loai_canh_bao); }
        if (trang_thai) { sql += " AND trang_thai = ?"; params.push(trang_thai); }

        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countResult] = await pool.query(countSql, params);
        const total = countResult[0].total;

        sql += " ORDER BY do_uu_tien DESC, created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);
        const [rows] = await pool.query(sql, params);

        return { data: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    static async getById(id) {
        const sql = 'SELECT * FROM canh_bao WHERE id = ?';
        const [rows] = await pool.query(sql, [id]);
        return rows[0];
    }

    static async create(data) {
        const { loai_canh_bao, mo_ta, do_uu_tien, ho_gia_dinh_id, thanh_vien_id, thue_bao_id, nguoi_phat_hien_id } = data;
        const sql = `INSERT INTO canh_bao (loai_canh_bao, mo_ta, do_uu_tien, ho_gia_dinh_id, thanh_vien_id, thue_bao_id, nguoi_phat_hien_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [loai_canh_bao, mo_ta, do_uu_tien || 'trung_binh', ho_gia_dinh_id || null, thanh_vien_id || null, thue_bao_id || null, nguoi_phat_hien_id || null]);
        return result.insertId;
    }

    static async xuLy(id, nguoi_xu_ly_id, ghi_chu_xu_ly) {
        const sql = `UPDATE canh_bao SET trang_thai = 'da_xu_ly', nguoi_xu_ly_id = ?, ghi_chu_xu_ly = ?, ngay_xu_ly = NOW() WHERE id = ?`;
        const [result] = await pool.query(sql, [nguoi_xu_ly_id, ghi_chu_xu_ly, id]);
        return result.affectedRows;
    }

    static async dong(id) {
        const sql = "UPDATE canh_bao SET trang_thai = 'da_dong' WHERE id = ?";
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }
}

module.exports = CanhBao;