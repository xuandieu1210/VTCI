// src/models/LichSuThayDoi.js
const pool = require('../config/database');

class LichSuThayDoi {
    static async create(data) {
        const { bang, record_id, hanh_dong, nguoi_thuc_hien_id, noi_dung_cu, noi_dung_moi, ip_address, user_agent } = data;
        const sql = `INSERT INTO lich_su_thay_doi (bang, record_id, hanh_dong, nguoi_thuc_hien_id, noi_dung_cu, noi_dung_moi, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [bang, record_id, hanh_dong, nguoi_thuc_hien_id || null, JSON.stringify(noi_dung_cu || {}), JSON.stringify(noi_dung_moi || {}), ip_address, user_agent]);
        return result.insertId;
    }

    static async getByRecord(bang, record_id) {
        const sql = 'SELECT * FROM lich_su_thay_doi WHERE bang = ? AND record_id = ? ORDER BY created_at DESC';
        const [rows] = await pool.query(sql, [bang, record_id]);
        return rows;
    }
}

module.exports = LichSuThayDoi;