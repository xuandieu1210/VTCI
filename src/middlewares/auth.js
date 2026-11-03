// src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const normalizePermissions = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch (error) {
            // ignore
        }

        return value.split(',').map(item => String(item).trim()).filter(Boolean);
    }

    return [];
};

const normalizeRole = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

exports.hasPermission = (user, permission) => {
    if (!user) return false;
    const role = normalizeRole(user.vai_tro || user.role);
    if (role === 'admin') return true;

    const legacyRoles = ['manager', 'staff'];
    if (legacyRoles.includes(role)) {
        const permissions = normalizePermissions(user.quyen_chuc_nang || []);
        return permissions.length === 0 || permissions.includes(permission);
    }

    const permissions = normalizePermissions(user.quyen_chuc_nang || []);
    return permissions.includes(permission);
};

exports.requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        if (!exports.hasPermission(req.session.user, permission)) {
            return res.status(403).render('pages/error', {
                title: 'Khong co quyen',
                message: 'Tai khoan nay khong co quyen truy cap tinh nang nay',
                user: req.session.user
            });
        }

        next();
    };
};

exports.authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = {
                ...decoded,
                quyen_chuc_nang: normalizePermissions(decoded.quyen_chuc_nang)
            };
            return next();
        }

        if (req.session && req.session.user) {
            req.user = {
                ...req.session.user,
                quyen_chuc_nang: normalizePermissions(req.session.user.quyen_chuc_nang)
            };
            return next();
        }

        return res.status(401).json({ success: false, message: 'Vui long dang nhap' });
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Token khong hop le' });
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Vui long dang nhap' });
        }

        const allowedRoles = roles.map(normalizeRole);
        const currentRole = normalizeRole(req.user.vai_tro || req.user.role || req.session?.user?.vai_tro || req.session?.user?.role);
        if (!allowedRoles.includes(currentRole)) {
            return res.status(403).json({ success: false, message: 'Khong co quyen truy cap' });
        }
        next();
    };
};

exports.requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

exports.requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const allowedRoles = roles.map(normalizeRole);
        const currentRole = normalizeRole(req.session.user.vai_tro || req.session.user.role);
        if (!allowedRoles.includes(currentRole)) {
            return res.status(403).render('pages/error', {
                title: 'Khong co quyen',
                message: 'Ban khong co quyen truy cap trang nay',
                user: req.session.user
            });
        }
        next();
    };
};