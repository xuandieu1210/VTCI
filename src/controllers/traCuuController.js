// src/controllers/traCuuController.js
const HoGiaDinh = require('../models/HoGiaDinh');
const ThanhVien = require('../models/ThanhVien');
const ThueBaoDichVu = require('../models/ThueBaoDichVu');
const pool = require('../config/database');

exports.traCuuHoGiaDinh = async (req, res) => {
    try {
        const result = await HoGiaDinh.getAll(req.body);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.traCuuThanhVien = async (req, res) => {
    try {
        const data = await ThanhVien.search(req.body);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.traCuuThueBao = async (req, res) => {
    try {
        const data = await ThueBaoDichVu.search(req.body);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.traCuuHoSo = async (req, res) => {
    try {
        const { ho_gia_dinh_id } = req.body;
        if (ho_gia_dinh_id) {
            const [rows] = await pool.query(
                'SELECT * FROM ho_so_dinh_kem WHERE ho_gia_dinh_id = ? ORDER BY created_at DESC',
                [ho_gia_dinh_id]
            );
            return res.json({ success: true, data: rows });
        }
        res.json({ success: true, data: [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.timKiemNhanh = async (req, res) => {
    try {
        const { keyword } = req.query;
        if (!keyword) {
            return res.json({ success: true, data: { ho: [], thanhVien: [], thueBao: [] } });
        }

        const s = '%' + keyword + '%';

        // Tim ho
        const [ho] = await pool.query(
            'SELECT * FROM ho_gia_dinh WHERE ten_chu_ho LIKE ? OR so_cmnd LIKE ? OR ma_ho LIKE ? LIMIT 10',
            [s, s, s]
        );

        // Tim thanh vien
        const [thanhVien] = await pool.query(
            'SELECT * FROM thanh_vien WHERE ho_ten LIKE ? OR so_cmnd LIKE ? LIMIT 10',
            [s, s]
        );

        // Tim thue bao
        const [thueBao] = await pool.query(
            'SELECT * FROM thue_bao_dich_vu WHERE so_thue_bao LIKE ? OR ten_chu_thue_bao LIKE ? LIMIT 10',
            [s, s]
        );

        res.json({ success: true, data: { ho, thanhVien, thueBao } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};