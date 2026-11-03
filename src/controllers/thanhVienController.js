// src/controllers/thanhVienController.js
const ThanhVien = require('../models/ThanhVien');

exports.getAll = async (req, res) => {
    try {
        const { ho_gia_dinh_id } = req.query;
        if (ho_gia_dinh_id) {
            const data = await ThanhVien.getByHoId(ho_gia_dinh_id);
            return res.json({ success: true, data });
        }
        res.json({ success: true, data: [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const data = await ThanhVien.getById(req.params.id);
        if (!data) {
            return res.status(404).json({ success: false, message: 'Khong tim thay thanh vien' });
        }
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const id = await ThanhVien.create(req.body);
        const data = await ThanhVien.getById(id);
        res.status(201).json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const affected = await ThanhVien.update(id, req.body);
        if (affected === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay thanh vien' });
        }
        const data = await ThanhVien.getById(id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const affected = await ThanhVien.delete(req.params.id);
        if (affected === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay thanh vien' });
        }
        res.json({ success: true, message: 'Xoa thanh vien thanh cong' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};