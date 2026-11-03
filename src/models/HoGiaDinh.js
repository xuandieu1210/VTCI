// src/models/HoGiaDinh.js
const pool = require('../config/database');

class HoGiaDinh {
    static async getAll(filters = {}) {
        const { page = 1, limit = 20, search = '', ma_ho = '', ten_chu_ho = '', so_cmnd = '',
            xa_id = null, loai_doi_tuong_id = null, trang_thai_ho = null, trang_thai_ho_so = null, vnpt_khu_vuc_id = null } = filters;

        const safePage = Number(page) > 0 ? Number(page) : 1;
        const safeLimit = Number(limit) > 0 ? Number(limit) : 20;
        const offset = (safePage - 1) * safeLimit;
        let sql = `
            SELECT DISTINCT h.*, x.ma_xa, x.ten_xa, x.ten_xa_cu, l.ten_loai as ten_loai_doi_tuong, v.ten_khu_vuc
            FROM ho_gia_dinh h
            LEFT JOIN danh_muc_xa x ON h.xa_id = x.id
            LEFT JOIN loai_doi_tuong l ON h.loai_doi_tuong_id = l.id
            LEFT JOIN vnpt_khu_vuc v ON h.vnpt_khu_vuc_id = v.id
            LEFT JOIN thue_bao_dich_vu tb ON tb.ho_gia_dinh_id = h.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += " AND (h.ten_chu_ho LIKE ? OR h.so_cmnd LIKE ? OR h.ma_ho LIKE ? OR tb.so_thue_bao LIKE ? OR tb.ten_chu_thue_bao LIKE ?)";
            const s = "%" + search + "%";
            params.push(s, s, s, s, s);
        }
        if (ma_ho) { sql += " AND h.ma_ho LIKE ?"; params.push("%" + ma_ho + "%"); }
        if (ten_chu_ho) { sql += " AND h.ten_chu_ho LIKE ?"; params.push("%" + ten_chu_ho + "%"); }
        if (so_cmnd) { sql += " AND h.so_cmnd LIKE ?"; params.push("%" + so_cmnd + "%"); }
        if (xa_id) { sql += " AND h.xa_id = ?"; params.push(xa_id); }
        if (vnpt_khu_vuc_id) { sql += " AND h.vnpt_khu_vuc_id = ?"; params.push(vnpt_khu_vuc_id); }
        if (loai_doi_tuong_id) { sql += " AND h.loai_doi_tuong_id = ?"; params.push(loai_doi_tuong_id); }
        if (trang_thai_ho) { sql += " AND h.trang_thai_ho = ?"; params.push(trang_thai_ho); }
        if (trang_thai_ho_so) { sql += " AND h.trang_thai_ho_so = ?"; params.push(trang_thai_ho_so); }

        const countSql = 'SELECT COUNT(DISTINCT h.id) as total FROM ho_gia_dinh h LEFT JOIN thue_bao_dich_vu tb ON tb.ho_gia_dinh_id = h.id WHERE 1=1';
        const countParams = [...params];
        let countQuery = countSql;
        if (search) {
            countQuery += ' AND (h.ten_chu_ho LIKE ? OR h.so_cmnd LIKE ? OR h.ma_ho LIKE ? OR tb.so_thue_bao LIKE ? OR tb.ten_chu_thue_bao LIKE ?)';
            countParams.push(...params.slice(0, 5));
        }
        if (ma_ho) { countQuery += ' AND h.ma_ho LIKE ?'; countParams.push('%' + ma_ho + '%'); }
        if (ten_chu_ho) { countQuery += ' AND h.ten_chu_ho LIKE ?'; countParams.push('%' + ten_chu_ho + '%'); }
        if (so_cmnd) { countQuery += ' AND h.so_cmnd LIKE ?'; countParams.push('%' + so_cmnd + '%'); }
        if (xa_id) { countQuery += ' AND h.xa_id = ?'; countParams.push(xa_id); }
        if (vnpt_khu_vuc_id) { countQuery += ' AND h.vnpt_khu_vuc_id = ?'; countParams.push(vnpt_khu_vuc_id); }
        if (loai_doi_tuong_id) { countQuery += ' AND h.loai_doi_tuong_id = ?'; countParams.push(loai_doi_tuong_id); }
        if (trang_thai_ho) { countQuery += ' AND h.trang_thai_ho = ?'; countParams.push(trang_thai_ho); }
        if (trang_thai_ho_so) { countQuery += ' AND h.trang_thai_ho_so = ?'; countParams.push(trang_thai_ho_so); }

        const [countResult] = await pool.query(countQuery, countParams);
        const total = countResult[0].total;

        sql += " ORDER BY h.created_at DESC LIMIT ? OFFSET ?";
        params.push(safeLimit, offset);
        const [rows] = await pool.query(sql, params);

        // Lấy thêm thành viên và thuê bao
        for (const ho of rows) {
            const [members] = await pool.query('SELECT * FROM thanh_vien WHERE ho_gia_dinh_id = ?', [ho.id]);
            ho.thanh_vien = members;
            const [thueBaos] = await pool.query(`
                SELECT tb.*, ldv.ten_dich_vu, ldv.loai_hinh, ldv.ma_dich_vu
                FROM thue_bao_dich_vu tb
                LEFT JOIN loai_dich_vu ldv ON tb.loai_dich_vu_id = ldv.id
                WHERE tb.ho_gia_dinh_id = ?
            `, [ho.id]);
            ho.thue_bao = thueBaos;
        }

        return { data: rows, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
    }

    static async getById(id) {
        const sql = `
            SELECT h.*, x.ma_xa, x.ten_xa, x.ten_xa_cu, l.ten_loai as ten_loai_doi_tuong, v.ten_khu_vuc
            FROM ho_gia_dinh h
            LEFT JOIN danh_muc_xa x ON h.xa_id = x.id
            LEFT JOIN loai_doi_tuong l ON h.loai_doi_tuong_id = l.id
            LEFT JOIN vnpt_khu_vuc v ON h.vnpt_khu_vuc_id = v.id
            WHERE h.id = ?
        `;
        const [rows] = await pool.query(sql, [id]);
        if (!rows[0]) return null;

        const ho = rows[0];
        const [members] = await pool.query('SELECT * FROM thanh_vien WHERE ho_gia_dinh_id = ?', [id]);
        ho.thanh_vien = members;
        const [thueBaos] = await pool.query(`
            SELECT tb.*, ldv.ten_dich_vu, ldv.loai_hinh, ldv.ma_dich_vu
            FROM thue_bao_dich_vu tb
            LEFT JOIN loai_dich_vu ldv ON tb.loai_dich_vu_id = ldv.id
            WHERE tb.ho_gia_dinh_id = ?
        `, [id]);
        ho.thue_bao = thueBaos;
        const [hoSo] = await pool.query('SELECT * FROM ho_so_dinh_kem WHERE ho_gia_dinh_id = ? ORDER BY created_at DESC', [id]);
        ho.ho_so = hoSo;

        return ho;
    }

    static async create(data) {
        const cleanValue = (value) => (value === '' || value === undefined || value === null ? null : value);
        const { ten_chu_ho, so_cmnd, xa_id, loai_doi_tuong_id, ngay_sinh, gioi_tinh, dia_chi_chi_tiet, so_thue_bao_chinh, vnpt_khu_vuc_id, trang_thai_ho, trang_thai_ho_so, ly_do_tu_choi, ghi_chu } = data;

        const safeXaId = cleanValue(xa_id);
        const safeLoaiId = cleanValue(loai_doi_tuong_id);
        const ma_ho = await this.generateMaHo(safeXaId);

        const sql = `INSERT INTO ho_gia_dinh (ma_ho, ten_chu_ho, so_cmnd, ngay_sinh, gioi_tinh, dia_chi_chi_tiet, xa_id, loai_doi_tuong_id, vnpt_khu_vuc_id, so_thue_bao_chinh, trang_thai_ho, trang_thai_ho_so, ly_do_tu_choi, ghi_chu)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const [result] = await pool.query(sql, [
            ma_ho,
            ten_chu_ho,
            so_cmnd,
            cleanValue(ngay_sinh),
            cleanValue(gioi_tinh),
            cleanValue(dia_chi_chi_tiet),
            safeXaId,
            safeLoaiId,
            cleanValue(vnpt_khu_vuc_id),
            cleanValue(so_thue_bao_chinh),
            trang_thai_ho || 'dang_hoat_dong',
            trang_thai_ho_so || 'chua_co',
            cleanValue(ly_do_tu_choi),
            cleanValue(ghi_chu)
        ]);
        return result.insertId;
    }

    static async generateMaHo(xa_id) {
        if (!xa_id) return 'HO_' + Date.now();
        const [xaResult] = await pool.query('SELECT ma_xa FROM danh_muc_xa WHERE id = ?', [xa_id]);
        const maXa = xaResult[0]?.ma_xa || 'XX';
        const [countResult] = await pool.query('SELECT COUNT(*) as count FROM ho_gia_dinh WHERE xa_id = ?', [xa_id]);
        const stt = String(countResult[0].count + 1).padStart(3, '0');
        return maXa + "_HO_" + stt;
    }

    static slugify(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    }

    static async update(id, data) {
        const fields = [];
        const values = [];
        const allowed = ['ten_chu_ho', 'so_cmnd', 'ngay_sinh', 'gioi_tinh', 'dia_chi_chi_tiet', 'xa_id', 'loai_doi_tuong_id', 'vnpt_khu_vuc_id', 'so_thue_bao_chinh', 'trang_thai_ho', 'trang_thai_ho_so', 'ly_do_tu_choi', 'ghi_chu'];
        for (const field of allowed) {
            if (data[field] !== undefined) {
                fields.push(field + " = ?");
                values.push(data[field] === '' ? null : data[field]);
            }
        }
        if (fields.length === 0) {
            const [existingRows] = await pool.query('SELECT id FROM ho_gia_dinh WHERE id = ? LIMIT 1', [id]);
            return existingRows.length > 0 ? 1 : 0;
        }
        values.push(id);
        const sql = "UPDATE ho_gia_dinh SET " + fields.join(', ') + " WHERE id = ?";
        const [result] = await pool.query(sql, values);
        return result.affectedRows;
    }

    static async delete(id) {
        const sql = 'DELETE FROM ho_gia_dinh WHERE id = ?';
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }

    static async checkDuplicateCMND(so_cmnd, excludeId = null) {
        let sql = 'SELECT COUNT(*) as count FROM ho_gia_dinh WHERE so_cmnd = ?';
        const params = [so_cmnd];
        if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }
        const [rows] = await pool.query(sql, params);
        return rows[0].count > 0;
    }

    static async getStatistics() {
        const [total] = await pool.query('SELECT COUNT(*) as total FROM ho_gia_dinh');
        const [byXa] = await pool.query('SELECT x.ten_xa, COUNT(h.id) as so_luong FROM ho_gia_dinh h JOIN danh_muc_xa x ON h.xa_id = x.id GROUP BY h.xa_id');
        const [byTrangThai] = await pool.query('SELECT trang_thai_ho, COUNT(*) as so_luong FROM ho_gia_dinh GROUP BY trang_thai_ho');
        const [byLoai] = await pool.query('SELECT l.ten_loai, COUNT(h.id) as so_luong FROM ho_gia_dinh h JOIN loai_doi_tuong l ON h.loai_doi_tuong_id = l.id GROUP BY h.loai_doi_tuong_id');
        return { total: total[0].total, byXa, byTrangThai, byLoai };
    }
}

module.exports = HoGiaDinh;