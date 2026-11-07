// src/controllers/hoGiaDinhController.js
const HoGiaDinh = require('../models/HoGiaDinh');
const ThanhVien = require('../models/ThanhVien');
const ThueBaoDichVu = require('../models/ThueBaoDichVu');

const normalizeRole = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const isVnptKhuVucUser = (user) => normalizeRole(user?.vai_tro || user?.role) === 'vnptkhuvuc';

const restrictVnptScope = (req, payload = {}) => {
    if (!req.user || !isVnptKhuVucUser(req.user)) return payload;

    const areaId = Number(req.user.vnpt_khu_vuc_id);
    if (!areaId) return payload;

    if (payload.vnpt_khu_vuc_id !== undefined && payload.vnpt_khu_vuc_id !== null && Number(payload.vnpt_khu_vuc_id) !== areaId) {
        throw new Error('Bạn chỉ được thao tác hộ gia đình thuộc khu vực VNPT của mình');
    }

    return { ...payload, vnpt_khu_vuc_id: areaId };
};

exports.getAll = async (req, res) => {
    try {
        const result = await HoGiaDinh.getAll(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDetail = async (req, res) => {
    try {
        const data = await HoGiaDinh.getById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Khong tim thay ho gia dinh' });

        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const payload = restrictVnptScope(req, req.body);
        if (['day_du', 'tu_choi'].includes(payload.trang_thai_ho_so)) {
            return res.status(400).json({ success: false, message: 'Trạng thái duyệt phải được cập nhật tại chức năng duyệt hồ sơ' });
        }
        const { so_cmnd } = payload;
        const isDuplicate = await HoGiaDinh.checkDuplicateCMND(so_cmnd);
        if (isDuplicate) {
            return res.status(400).json({ success: false, message: 'So CMND/CCCD da ton tai' });
        }
        const id = await HoGiaDinh.create(payload);
        const data = await HoGiaDinh.getById(id);
        res.status(201).json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const existing = await HoGiaDinh.getById(req.params.id);
        if (isVnptKhuVucUser(req.user)) {
            const areaId = Number(req.user.vnpt_khu_vuc_id);
            if (areaId && Number(existing?.vnpt_khu_vuc_id) !== areaId) {
                return res.status(403).json({ success: false, message: 'Bạn chỉ được sửa hộ gia đình thuộc khu vực VNPT của mình' });
            }
        }

        const payload = restrictVnptScope(req, req.body);
        if (['day_du', 'tu_choi'].includes(payload.trang_thai_ho_so)) {
            return res.status(400).json({ success: false, message: 'Trạng thái duyệt phải được cập nhật tại chức năng duyệt hồ sơ' });
        }
        if (payload.so_cmnd) {
            const isDuplicate = await HoGiaDinh.checkDuplicateCMND(payload.so_cmnd, req.params.id);
            if (isDuplicate) {
                return res.status(400).json({ success: false, message: 'So CMND/CCCD da ton tai' });
            }
        }
        const affected = await HoGiaDinh.update(req.params.id, payload);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay ho gia dinh' });
        const data = await HoGiaDinh.getById(req.params.id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const existing = await HoGiaDinh.getById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Khong tim thay ho gia dinh' });

        if (isVnptKhuVucUser(req.user)) {
            const areaId = Number(req.user.vnpt_khu_vuc_id);
            if (areaId && Number(existing.vnpt_khu_vuc_id) !== areaId) {
                return res.status(403).json({ success: false, message: 'Bạn chỉ được xóa hộ gia đình thuộc khu vực VNPT của mình' });
            }
        }

        const affected = await HoGiaDinh.delete(req.params.id);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay ho gia dinh' });
        res.json({ success: true, message: 'Xoa thanh cong' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getStatistics = async (req, res) => {
    try {
        const stats = await HoGiaDinh.getStatistics();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ===== Thanh vien =====
exports.addThanhVien = async (req, res) => {
    try {
        const { id } = req.params;
        const data = { ...req.body, ho_gia_dinh_id: id };
        const tvId = await ThanhVien.create(data);
        const tv = await ThanhVien.getById(tvId);
        res.status(201).json({ success: true, data: tv });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteThanhVien = async (req, res) => {
    try {
        const affected = await ThanhVien.delete(req.params.id);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay thanh vien' });
        res.json({ success: true, message: 'Xoa thanh vien thanh cong' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ===== Thue bao =====
exports.addThueBao = async (req, res) => {
    try {
        const { id } = req.params;
        const data = { ...req.body, ho_gia_dinh_id: id };
        const tbId = await ThueBaoDichVu.create(data);
        const tb = await ThueBaoDichVu.getById(tbId);
        res.status(201).json({ success: true, data: tb });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteThueBao = async (req, res) => {
    try {
        const affected = await ThueBaoDichVu.delete(req.params.id);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Khong tim thay thue bao' });
        res.json({ success: true, message: 'Xoa thue bao thanh cong' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};