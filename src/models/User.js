// src/models/User.js
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    static async ensureUserPermissionColumn() {
        try {
            const [columns] = await pool.query(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'quyen_chuc_nang'"
            );
            if (!columns.length) {
                await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS quyen_chuc_nang TEXT NULL');
            }
        } catch (error) {
            console.error('User permission schema sync failed:', error.message);
            throw error;
        }
    }

    static normalizePermissions(value) {
        if (Array.isArray(value)) return value.filter(Boolean);
        if (!value) return [];

        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) return parsed.filter(Boolean);
            } catch (error) {
                // Ignore JSON parse issues and fall back to CSV parsing.
            }

            return value
                .split(',')
                .map(item => String(item).trim())
                .filter(Boolean);
        }

        return [];
    }

    static async getAll({ search = '', vai_tro = null, trang_thai = null, page = 1, limit = 20 }) {
        const safePage = Number(page) > 0 ? Number(page) : 1;
        const safeLimit = Number(limit) > 0 ? Number(limit) : 20;
        const offset = (safePage - 1) * safeLimit;
        let sql = `
            SELECT u.*, x.ten_xa, v.ten_khu_vuc
            FROM users u
            LEFT JOIN danh_muc_xa x ON u.xa_quan_ly_id = x.id
            LEFT JOIN vnpt_khu_vuc v ON u.vnpt_khu_vuc_id = v.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += " AND (u.username ILIKE ? OR u.ho_ten ILIKE ? OR u.email ILIKE ?)";
            const s = "%" + search + "%";
            params.push(s, s, s);
        }
        if (vai_tro) { sql += " AND u.vai_tro = ?"; params.push(vai_tro); }
        if (trang_thai) { sql += " AND u.trang_thai = ?"; params.push(trang_thai); }

        const countSql = sql.replace(/SELECT[\s\S]*?FROM\s+/i, 'SELECT COUNT(*) as total FROM ');
        const [countResult] = await pool.query(countSql, params);
        const total = Number(countResult[0]?.total || 0);

        sql += " ORDER BY u.created_at DESC LIMIT ? OFFSET ?";
        params.push(safeLimit, offset);
        const [rows] = await pool.query(sql, params);
        rows.forEach(row => {
            row.quyen_chuc_nang = User.normalizePermissions(row.quyen_chuc_nang);
            delete row.password;
        });

        return { data: rows, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
    }

    static async getById(id) {
        const sql = `
            SELECT u.*, x.ten_xa, v.ten_khu_vuc
            FROM users u
            LEFT JOIN danh_muc_xa x ON u.xa_quan_ly_id = x.id
            LEFT JOIN vnpt_khu_vuc v ON u.vnpt_khu_vuc_id = v.id
            WHERE u.id = ?
        `;
        const [rows] = await pool.query(sql, [id]);
        if (rows[0]) {
            rows[0].quyen_chuc_nang = User.normalizePermissions(rows[0].quyen_chuc_nang);
            delete rows[0].password;
        }
        return rows[0];
    }

    static async findByUsername(username) {
        const sql = 'SELECT * FROM users WHERE username = ?';
        const [rows] = await pool.query(sql, [username]);
        return rows[0];
    }

    static async create(data) {
        await User.ensureUserPermissionColumn();

        const { username, password, ho_ten, email, so_dien_thoai, vai_tro, xa_quan_ly_id, vnpt_khu_vuc_id, quyen_chuc_nang } = data;
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM users WHERE username = ? OR email = ?', [username, email]);
        if (dupCheck[0].count > 0) throw new Error('Ten dang nhap hoac email da ton tai');

        const permissions = User.normalizePermissions(quyen_chuc_nang);
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (username, password, ho_ten, email, so_dien_thoai, vai_tro, xa_quan_ly_id, vnpt_khu_vuc_id, quyen_chuc_nang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [username, hashedPassword, ho_ten, email, so_dien_thoai, vai_tro || 'staff', xa_quan_ly_id, vnpt_khu_vuc_id, JSON.stringify(permissions)]);
        return result.insertId;
    }

    static async update(id, data) {
        await User.ensureUserPermissionColumn();

        const updates = [];
        const values = [];
        const payload = { ...data };

        const normalizedRole = String(payload.vai_tro || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedRole !== 'vnptkhuvuc') {
            payload.vnpt_khu_vuc_id = null;
        }

        const allowedFields = ['username', 'ho_ten', 'email', 'so_dien_thoai', 'vai_tro', 'xa_quan_ly_id', 'vnpt_khu_vuc_id', 'quyen_chuc_nang', 'trang_thai'];

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(payload, field)) {
                updates.push(`${field} = ?`);

                const rawValue = payload[field];
                const value = field === 'quyen_chuc_nang'
                    ? JSON.stringify(User.normalizePermissions(rawValue))
                    : (field === 'vnpt_khu_vuc_id' && rawValue === '' ? null : rawValue);

                values.push(value);
            }
        }

        if (!updates.length) return 0;

        if (payload.username) {
            const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM users WHERE username = ? AND id != ?', [payload.username, id]);
            if (dupCheck[0].count > 0) throw new Error('Ten dang nhap da ton tai');
        }

        if (payload.email) {
            const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM users WHERE email = ? AND id != ?', [payload.email, id]);
            if (dupCheck[0].count > 0) throw new Error('Email da ton tai');
        }

        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        values.push(id);
        const [result] = await pool.query(sql, values);
        return result.affectedRows;
    }

    static async changePassword(id, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const sql = 'UPDATE users SET password = ? WHERE id = ?';
        const [result] = await pool.query(sql, [hashedPassword, id]);
        return result.affectedRows;
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    static async updateLastLogin(id) {
        const sql = 'UPDATE users SET last_login = NOW() WHERE id = ?';
        await pool.query(sql, [id]);
    }
}

module.exports = User;