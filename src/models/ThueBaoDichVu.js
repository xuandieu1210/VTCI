// src/models/ThueBaoDichVu.js
const pool = require('../config/database');

const normalizeDate = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

const ensureDateOrder = ({ ngay_dang_ky, ngay_kich_hoat, ngay_het_han }) => {
    const ngayDangKy = ngay_dang_ky ? new Date(ngay_dang_ky) : null;
    const ngayKichHoat = ngay_kich_hoat ? new Date(ngay_kich_hoat) : null;
    const ngayHetHan = ngay_het_han ? new Date(ngay_het_han) : null;

    if (ngayDangKy && ngayKichHoat && ngayKichHoat < ngayDangKy) {
        throw new Error('Ngay kich hoat khong duoc truoc ngay dang ky');
    }

    if (ngayDangKy && ngayHetHan && ngayHetHan < ngayDangKy) {
        throw new Error('Ngay het han khong duoc truoc ngay dang ky');
    }

    if (ngayKichHoat && ngayHetHan && ngayHetHan < ngayKichHoat) {
        throw new Error('Ngay het han khong duoc truoc ngay kich hoat');
    }
};

class ThueBaoDichVu {
    static async getByHoId(ho_gia_dinh_id) {
        const sql = `
            SELECT tb.*, ldv.ten_dich_vu, ldv.loai_hinh
            FROM thue_bao_dich_vu tb
            LEFT JOIN loai_dich_vu ldv ON tb.loai_dich_vu_id = ldv.id
            WHERE tb.ho_gia_dinh_id = ?
            ORDER BY tb.created_at DESC
        `;
        const [rows] = await pool.query(sql, [ho_gia_dinh_id]);
        return rows;
    }

    static async getById(id) {
        const sql = `
            SELECT tb.*, ldv.ten_dich_vu, ldv.loai_hinh
            FROM thue_bao_dich_vu tb
            LEFT JOIN loai_dich_vu ldv ON tb.loai_dich_vu_id = ldv.id
            WHERE tb.id = ?
        `;
        const [rows] = await pool.query(sql, [id]);
        return rows[0];
    }

    static async create(data) {
        const { ho_gia_dinh_id, thanh_vien_id, loai_dich_vu_id, so_thue_bao, ten_chu_thue_bao, cmnd_chu_thue_bao, goi_cuoc_dang_ky, ngay_dang_ky, ngay_kich_hoat, ngay_het_han, trang_thai_dich_vu, ghi_chu } = data;
        const normalizedThueBao = String(so_thue_bao || '').trim();
        const normalizedNgayDangKy = normalizeDate(ngay_dang_ky);
        const normalizedNgayKichHoat = normalizeDate(ngay_kich_hoat);
        const normalizedNgayHetHan = normalizeDate(ngay_het_han);

        if (!normalizedThueBao) {
            throw new Error('So thue bao la bat buoc');
        }

        ensureDateOrder({
            ngay_dang_ky: normalizedNgayDangKy,
            ngay_kich_hoat: normalizedNgayKichHoat,
            ngay_het_han: normalizedNgayHetHan
        });

        if (ho_gia_dinh_id) {
            const [existing] = await pool.query('SELECT COUNT(*) as count FROM thue_bao_dich_vu WHERE ho_gia_dinh_id = ?', [ho_gia_dinh_id]);
            if (existing[0].count > 0) {
                throw new Error('Moi ho gia dinh chi duoc mot thue bao dich vu');
            }
        }
        const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM thue_bao_dich_vu WHERE so_thue_bao = ?', [normalizedThueBao]);
        if (dupCheck[0].count > 0) throw new Error('So thue bao da ton tai trong he thong');
        const sql = `INSERT INTO thue_bao_dich_vu (ho_gia_dinh_id, thanh_vien_id, loai_dich_vu_id, so_thue_bao, ten_chu_thue_bao, cmnd_chu_thue_bao, goi_cuoc_dang_ky, ngay_dang_ky, ngay_kich_hoat, ngay_het_han, trang_thai_dich_vu, ghi_chu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [ho_gia_dinh_id, thanh_vien_id || null, loai_dich_vu_id, normalizedThueBao, ten_chu_thue_bao, cmnd_chu_thue_bao, goi_cuoc_dang_ky, normalizedNgayDangKy || new Date().toISOString().slice(0, 10), normalizedNgayKichHoat, normalizedNgayHetHan, trang_thai_dich_vu || 'cho_kich_hoat', ghi_chu]);
        return result.insertId;
    }

    static async update(id, data) {
        const { ho_gia_dinh_id, thanh_vien_id, loai_dich_vu_id, so_thue_bao, ten_chu_thue_bao, cmnd_chu_thue_bao, goi_cuoc_dang_ky, ngay_dang_ky, ngay_kich_hoat, ngay_het_han, trang_thai_dich_vu, ghi_chu } = data;
        const normalizedThueBao = String(so_thue_bao || '').trim();
        const normalizedNgayDangKy = normalizeDate(ngay_dang_ky);
        const normalizedNgayKichHoat = normalizeDate(ngay_kich_hoat);
        const normalizedNgayHetHan = normalizeDate(ngay_het_han);

        if (!normalizedThueBao) {
            throw new Error('So thue bao la bat buoc');
        }

        ensureDateOrder({
            ngay_dang_ky: normalizedNgayDangKy,
            ngay_kich_hoat: normalizedNgayKichHoat,
            ngay_het_han: normalizedNgayHetHan
        });

        if (normalizedThueBao) {
            const [dupCheck] = await pool.query('SELECT COUNT(*) as count FROM thue_bao_dich_vu WHERE so_thue_bao = ? AND id != ?', [normalizedThueBao, id]);
            if (dupCheck[0].count > 0) throw new Error('So thue bao da ton tai trong he thong');
        }
        if (ho_gia_dinh_id) {
            const [existing] = await pool.query('SELECT COUNT(*) as count FROM thue_bao_dich_vu WHERE ho_gia_dinh_id = ? AND id != ?', [ho_gia_dinh_id, id]);
            if (existing[0].count > 0) {
                throw new Error('Moi ho gia dinh chi duoc mot thue bao dich vu');
            }
        }
        const sql = `UPDATE thue_bao_dich_vu SET thanh_vien_id = ?, loai_dich_vu_id = ?, so_thue_bao = ?, ten_chu_thue_bao = ?, cmnd_chu_thue_bao = ?, goi_cuoc_dang_ky = ?, ngay_dang_ky = ?, ngay_kich_hoat = ?, ngay_het_han = ?, trang_thai_dich_vu = ?, ghi_chu = ? WHERE id = ?`;
        const [result] = await pool.query(sql, [thanh_vien_id || null, loai_dich_vu_id, normalizedThueBao, ten_chu_thue_bao, cmnd_chu_thue_bao, goi_cuoc_dang_ky, normalizedNgayDangKy, normalizedNgayKichHoat, normalizedNgayHetHan, trang_thai_dich_vu, ghi_chu, id]);
        return result.affectedRows;
    }

    static async delete(id) {
        const sql = 'DELETE FROM thue_bao_dich_vu WHERE id = ?';
        const [result] = await pool.query(sql, [id]);
        return result.affectedRows;
    }
}

module.exports = ThueBaoDichVu;