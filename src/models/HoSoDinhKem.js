// src/models/HoSoDinhKem.js
const pool = require('../config/database');
const fs = require('fs');
const { resolveHoSoPath } = require('../utils/fileHelper');

class HoSoDinhKem {
    static async getByHoId(ho_gia_dinh_id) {
        const sql = `
            SELECT hs.*, tv.ho_ten as ten_thanh_vien
            FROM ho_so_dinh_kem hs
            LEFT JOIN thanh_vien tv ON hs.thanh_vien_id = tv.id
            WHERE hs.ho_gia_dinh_id = ?
            ORDER BY hs.created_at DESC
        `;
        const [rows] = await pool.query(sql, [ho_gia_dinh_id]);
        return rows;
    }

    static async getById(id) {
        const sql = 'SELECT * FROM ho_so_dinh_kem WHERE id = ?';
        const [rows] = await pool.query(sql, [id]);
        return rows[0];
    }

    static async create(data) {
        const { ho_gia_dinh_id, thanh_vien_id, loai_ho_so, nam_ho_so, ten_file, duong_dan_file, dung_luong, dinh_dang, ngay_het_han, trang_thai, nguoi_tai_len, mo_ta } = data;
        const sql = `INSERT INTO ho_so_dinh_kem (ho_gia_dinh_id, thanh_vien_id, loai_ho_so, nam_ho_so, ten_file, duong_dan_file, dung_luong, dinh_dang, ngay_het_han, trang_thai, nguoi_tai_len, mo_ta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [ho_gia_dinh_id, thanh_vien_id || null, loai_ho_so, nam_ho_so || null, ten_file, duong_dan_file, dung_luong, dinh_dang, ngay_het_han, trang_thai || 'con_hieu_luc', nguoi_tai_len, mo_ta]);
        return result.insertId;
    }

    static async delete(id) {
        const hoSo = await this.getById(id);
        if (hoSo) {
            const filePath = resolveHoSoPath(hoSo.duong_dan_file);
            if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        const sql = 'DELETE FROM ho_so_dinh_kem WHERE id = ?';
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }
}

module.exports = HoSoDinhKem;