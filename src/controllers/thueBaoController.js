// src/controllers/thueBaoController.js
const ThueBaoDichVu = require('../models/ThueBaoDichVu');

exports.getAll = async (req, res) => {
    try {
        const { ho_gia_dinh_id } = req.query;
        if (ho_gia_dinh_id) {
            const data = await ThueBaoDichVu.getByHoId(ho_gia_dinh_id);
            return res.json({ success: true, data });
        }
        res.json({ success: true, data: [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const data = await ThueBaoDichVu.getById(req.params.id);
        if (!data) {
            return res.status(404).json({ success: false, message: 'Khong tim thay thue bao' });
        }
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const id = await ThueBaoDichVu.create(req.body);
        const data = await ThueBaoDichVu.getById(id);
        res.status(201).json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const affected = await ThueBaoDichVu.update(id, req.body);
        if (affected === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay thue bao' });
        }
        const data = await ThueBaoDichVu.getById(id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const affected = await ThueBaoDichVu.delete(req.params.id);
        if (affected === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay thue bao' });
        }
        res.json({ success: true, message: 'Xoa thue bao thanh cong' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};