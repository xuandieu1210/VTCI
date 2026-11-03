// src/controllers/cauHinhController.js
const pool = require('../config/database');

exports.getAll = async (req, res) => {
    try {
        const { nhom, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        let sql = 'SELECT * FROM cau_hinh_he_thong WHERE 1=1';
        const params = [];

        if (nhom) { sql += " AND nhom = ?"; params.push(nhom); }

        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countResult] = await pool.query(countSql, params);
        const total = countResult[0]?.total || 0;

        sql += ' ORDER BY nhom, ten_cau_hinh LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        const [rows] = await pool.query(sql, params);

        res.json({
            success: true,
            data: rows || [],
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getByMa = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM cau_hinh_he_thong WHERE ma_cau_hinh = ?', [req.params.ma_cau_hinh]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay cau hinh' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getByGroup = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM cau_hinh_he_thong WHERE nhom = ? ORDER BY ten_cau_hinh', [req.params.nhom]);
        res.json({ success: true, data: rows || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { ma_cau_hinh, ten_cau_hinh, gia_tri, loai_du_lieu, mo_ta, nhom } = req.body;
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM cau_hinh_he_thong WHERE ma_cau_hinh = ?', [ma_cau_hinh]);
        if (dupCheck[0].count > 0) throw new Error('Ma cau hinh da ton tai');
        
        const sql = `INSERT INTO cau_hinh_he_thong (ma_cau_hinh, ten_cau_hinh, gia_tri, loai_du_lieu, mo_ta, nhom) VALUES (?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [ma_cau_hinh, ten_cau_hinh, gia_tri, loai_du_lieu || 'text', mo_ta, nhom]);
        const [rows] = await pool.query('SELECT * FROM cau_hinh_he_thong WHERE id = ?', [result.insertId]);
        res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { ma_cau_hinh, ten_cau_hinh, gia_tri, loai_du_lieu, mo_ta, nhom } = req.body;
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM cau_hinh_he_thong WHERE ma_cau_hinh = ? AND id != ?', [ma_cau_hinh, id]);
        if (dupCheck[0].count > 0) throw new Error('Ma cau hinh da ton tai');
        
        const sql = `UPDATE cau_hinh_he_thong SET ma_cau_hinh = ?, ten_cau_hinh = ?, gia_tri = ?, loai_du_lieu = ?, mo_ta = ?, nhom = ? WHERE id = ?`;
        const [result] = await pool.query(sql, [ma_cau_hinh, ten_cau_hinh, gia_tri, loai_du_lieu, mo_ta, nhom, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay cau hinh' });
        }
        const [rows] = await pool.query('SELECT * FROM cau_hinh_he_thong WHERE id = ?', [id]);
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM cau_hinh_he_thong WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay cau hinh' });
        }
        res.json({ success: true, message: 'Xoa cau hinh thanh cong' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};