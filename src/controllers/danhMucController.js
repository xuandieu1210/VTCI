// src/controllers/danhMucController.js
const DanhMucXa = require('../models/DanhMucXa');
const LoaiDoiTuong = require('../models/LoaiDoiTuong');
const LoaiDichVu = require('../models/LoaiDichVu');
const VNPTKhuVuc = require('../models/VNPTKhuVuc');

// ===== Xa =====
exports.getXaList = async (req, res) => {
    try {
        const result = await DanhMucXa.getAll(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getXaById = async (req, res) => {
    try {
        const data = await DanhMucXa.getById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Khong tim thay xa' });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createXa = async (req, res) => {
    try {
        const id = await DanhMucXa.create(req.body);
        const data = await DanhMucXa.getById(id);
        res.status(201).json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateXa = async (req, res) => {
    try {
        const affected = await DanhMucXa.update(req.params.id, req.body);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay xa' });
        const data = await DanhMucXa.getById(req.params.id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteXa = async (req, res) => {
    try {
        const affected = await DanhMucXa.deletePermanent(req.params.id);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay xa' });
        res.json({ success: true, message: 'Da xoa xa vinh vien' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deactivateXa = async (req, res) => {
    try {
        const affected = await DanhMucXa.deactivate(req.params.id);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay xa' });
        res.json({ success: true, message: 'Da ngung su dung xa' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ===== Loai doi tuong =====
exports.getLoaiDoiTuong = async (req, res) => {
    try {
        const result = await LoaiDoiTuong.getAll(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createLoaiDoiTuong = async (req, res) => {
    try {
        const id = await LoaiDoiTuong.create(req.body);
        const data = await LoaiDoiTuong.getById(id);
        res.status(201).json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateLoaiDoiTuong = async (req, res) => {
    try {
        const affected = await LoaiDoiTuong.update(req.params.id, req.body);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay loai doi tuong' });
        const data = await LoaiDoiTuong.getById(req.params.id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteLoaiDoiTuong = async (req, res) => {
    try {
        const affected = await LoaiDoiTuong.deletePermanent(req.params.id);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay loai doi tuong' });
        res.json({ success: true, message: 'Da xoa loai doi tuong vinh vien' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deactivateLoaiDoiTuong = async (req, res) => {
    try {
        const affected = await LoaiDoiTuong.deactivate(req.params.id);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay loai doi tuong' });
        res.json({ success: true, message: 'Da ngung su dung loai doi tuong' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ===== Loai dich vu =====
exports.getLoaiDichVu = async (req, res) => {
    try {
        const result = await LoaiDichVu.getAll(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createLoaiDichVu = async (req, res) => {
    try {
        const id = await LoaiDichVu.create(req.body);
        const data = await LoaiDichVu.getById(id);
        res.status(201).json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateLoaiDichVu = async (req, res) => {
    try {
        const affected = await LoaiDichVu.update(req.params.id, req.body);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay loai dich vu' });
        const data = await LoaiDichVu.getById(req.params.id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteLoaiDichVu = async (req, res) => {
    try {
        const affected = await LoaiDichVu.deletePermanent(req.params.id);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay loai dich vu' });
        res.json({ success: true, message: 'Da xoa loai dich vu vinh vien' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deactivateLoaiDichVu = async (req, res) => {
    try {
        const affected = await LoaiDichVu.deactivate(req.params.id);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay loai dich vu' });
        res.json({ success: true, message: 'Da ngung su dung loai dich vu' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ===== VNPT Khu vuc =====
exports.getVNPTKhuVuc = async (req, res) => {
    try {
        const result = await VNPTKhuVuc.getAll(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createVNPTKhuVuc = async (req, res) => {
    try {
        const id = await VNPTKhuVuc.create(req.body);
        const data = await VNPTKhuVuc.getById(id);
        res.status(201).json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateVNPTKhuVuc = async (req, res) => {
    try {
        const affected = await VNPTKhuVuc.update(req.params.id, req.body);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay khu vuc' });
        const data = await VNPTKhuVuc.getById(req.params.id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteVNPTKhuVuc = async (req, res) => {
    try {
        const affected = await VNPTKhuVuc.deletePermanent(req.params.id);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay khu vuc' });
        res.json({ success: true, message: 'Da xoa khu vuc vinh vien' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deactivateVNPTKhuVuc = async (req, res) => {
    try {
        const affected = await VNPTKhuVuc.deactivate(req.params.id);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay khu vuc' });
        res.json({ success: true, message: 'Da ngung su dung khu vuc' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};