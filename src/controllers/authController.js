// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin' });
        }

        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }

        if (user.trang_thai === 'khoa') {
            return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa' });
        }

        const isValid = await User.verifyPassword(password, user.password);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }

        await User.updateLastLogin(user.id);

        const permissions = User.normalizePermissions(user.quyen_chuc_nang);
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                vai_tro: user.vai_tro,
                quyen_chuc_nang: permissions,
                vnpt_khu_vuc_id: user.vnpt_khu_vuc_id,
                xa_quan_ly_id: user.xa_quan_ly_id
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        user.quyen_chuc_nang = permissions;
        delete user.password;
        res.json({ success: true, data: { user, token } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.getById(req.user.id);
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findByUsername(req.user.username);
        const isValid = await User.verifyPassword(oldPassword, user.password);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Mật khẩu cũ không đúng' });
        }
        await User.changePassword(req.user.id, newPassword);
        res.json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const result = await User.getAll(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const payload = req.body || {};
        const normalizedRole = String(payload.vai_tro || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!payload.username || !payload.password || !payload.ho_ten || !payload.email) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin tài khoản' });
        }
        if (normalizedRole === 'vnptkhuvuc' && !payload.vnpt_khu_vuc_id) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn khu vực VNPT cho tài khoản khu vực' });
        }

        const id = await User.create(payload);
        const user = await User.getById(id);
        res.status(201).json({ success: true, data: user, message: 'Tạo tài khoản thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const affected = await User.update(id, req.body);
        if (affected === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        const user = await User.getById(id);
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.lockUser = async (req, res) => {
    try {
        const { id } = req.params;
        await User.update(id, { trang_thai: 'khoa' });
        res.json({ success: true, message: 'Đã khóa tài khoản' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.unlockUser = async (req, res) => {
    try {
        const { id } = req.params;
        await User.update(id, { trang_thai: 'dang_hoat_dong' });
        res.json({ success: true, message: 'Đã mở khóa tài khoản' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.resetUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const newPassword = 'Vnpt@2026';
        await User.changePassword(id, newPassword);
        res.json({ success: true, message: 'Mật khẩu mới: ' + newPassword });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};