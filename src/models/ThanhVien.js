// src/models/ThanhVien.js
const pool = require('../config/database');

class ThanhVien {
    static async getByHoId(ho_gia_dinh_id) {
        const sql = 'SELECT * FROM thanh_vien WHERE ho_gia_dinh_id = ? ORDER BY quan_he_chu_ho';
        const [rows] = await pool.query(sql, [ho_gia_dinh_id]);
        return rows;
    }

    static async getById(id) {
        const sql = 'SELECT * FROM thanh_vien WHERE id = ?';
        const [rows] = await pool.query(sql, [id]);
        return rows[0];
    }

    static async create(data) {
        const { ho_gia_dinh_id, ho_ten, so_cmnd, ngay_sinh, gioi_tinh, quan_he_chu_ho, so_dien_thoai, email, nghe_nghiep, ghi_chu, dung_dich_vu, la_chu_ho_dung_dich_vu } = data;
        const isUsingService = dung_dich_vu === true || dung_dich_vu === 'true' || dung_dich_vu === 1 || dung_dich_vu === '1' ? 1 : 0;
        const isHeadUsingService = la_chu_ho_dung_dich_vu === true || la_chu_ho_dung_dich_vu === 'true' || la_chu_ho_dung_dich_vu === 1 || la_chu_ho_dung_dich_vu === '1' ? 1 : 0;

        if (so_cmnd) {
            const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM thanh_vien WHERE so_cmnd = ?', [so_cmnd]);
            if (dupCheck[0].count > 0) throw new Error('So CMND da ton tai trong he thong');
        }
        const sql = `INSERT INTO thanh_vien (ho_gia_dinh_id, ho_ten, so_cmnd, ngay_sinh, gioi_tinh, quan_he_chu_ho, so_dien_thoai, email, nghe_nghiep, ghi_chu, dung_dich_vu, la_chu_ho_dung_dich_vu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [ho_gia_dinh_id, ho_ten, so_cmnd, ngay_sinh, gioi_tinh, quan_he_chu_ho, so_dien_thoai, email, nghe_nghiep, ghi_chu, isUsingService, isHeadUsingService]);
        return result.insertId;
    }

    static async update(id, data) {
        const { ho_ten, so_cmnd, ngay_sinh, gioi_tinh, quan_he_chu_ho, so_dien_thoai, email, nghe_nghiep, ghi_chu, dung_dich_vu, la_chu_ho_dung_dich_vu } = data;
        const isUsingService = dung_dich_vu === true || dung_dich_vu === 'true' || dung_dich_vu === 1 || dung_dich_vu === '1' ? 1 : 0;
        const isHeadUsingService = la_chu_ho_dung_dich_vu === true || la_chu_ho_dung_dich_vu === 'true' || la_chu_ho_dung_dich_vu === 1 || la_chu_ho_dung_dich_vu === '1' ? 1 : 0;

        if (so_cmnd) {
            const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM thanh_vien WHERE so_cmnd = ? AND id != ?', [so_cmnd, id]);
            if (dupCheck[0].count > 0) throw new Error('So CMND da ton tai trong he thong');
        }
        const sql = `UPDATE thanh_vien SET ho_ten = ?, so_cmnd = ?, ngay_sinh = ?, gioi_tinh = ?, quan_he_chu_ho = ?, so_dien_thoai = ?, email = ?, nghe_nghiep = ?, ghi_chu = ?, dung_dich_vu = ?, la_chu_ho_dung_dich_vu = ? WHERE id = ?`;
        const [result] = await pool.query(sql, [ho_ten, so_cmnd, ngay_sinh, gioi_tinh, quan_he_chu_ho, so_dien_thoai, email, nghe_nghiep, ghi_chu, isUsingService, isHeadUsingService, id]);
        return result.affectedRows;
    }

    static async delete(id) {
        const sql = 'DELETE FROM thanh_vien WHERE id = ?';
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }
}

module.exports = ThanhVien;