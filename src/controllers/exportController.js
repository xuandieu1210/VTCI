// src/controllers/exportController.js
const XLSX = require('xlsx');
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

exports.exportExcel = async (req, res) => {
    try {
        const { xa_id, loai_doi_tuong_id, trang_thai_ho, vnpt_khu_vuc_id, search, thieu_ho_so } = req.query;
        const [namHoSoColumns] = await pool.query("SHOW COLUMNS FROM ho_so_dinh_kem LIKE 'nam_ho_so'");
        const yearExpr = namHoSoColumns.length > 0 ? 'COALESCE(hs.nam_ho_so, YEAR(hs.created_at))' : 'YEAR(hs.created_at)';

        let sql = `
            SELECT
                   x.ma_xa,
                   h.ten_chu_ho,
                   h.so_cmnd,
                   x.ten_xa,
                   l.ten_loai as loai_doi_tuong,
                     CASE WHEN SUM(CASE WHEN LOWER(COALESCE(ldv.loai_hinh, '')) IN ('di_dong_mat_dat', 'vien_thong_di_dong_mat_dat') OR LOWER(COALESCE(ldv.ma_dich_vu, '')) = 'dmdd' THEN 1 ELSE 0 END) > 0 THEN 'x' ELSE '' END AS dich_vu_di_dong,
                     CASE WHEN SUM(CASE WHEN LOWER(COALESCE(ldv.loai_hinh, '')) IN ('internet_brcd', 'truy_nhap_internet_brcd_mat_dat', 'brcd') OR LOWER(COALESCE(ldv.ma_dich_vu, '')) = 'ibrcd' THEN 1 ELSE 0 END) > 0 THEN 'x' ELSE '' END AS dich_vu_internet_brcd,
                   MAX(tb.so_thue_bao) as so_thue_bao,
                   v.ten_khu_vuc
            FROM ho_gia_dinh h
            LEFT JOIN danh_muc_xa x ON h.xa_id = x.id
            LEFT JOIN loai_doi_tuong l ON h.loai_doi_tuong_id = l.id
            LEFT JOIN vnpt_khu_vuc v ON h.vnpt_khu_vuc_id = v.id
            LEFT JOIN thue_bao_dich_vu tb ON tb.ho_gia_dinh_id = h.id
            LEFT JOIN loai_dich_vu ldv ON tb.loai_dich_vu_id = ldv.id
            LEFT JOIN ho_so_dinh_kem hs ON hs.ho_gia_dinh_id = h.id
            WHERE 1=1
        `;
        const params = [];

        if (xa_id) { sql += ' AND h.xa_id = ?'; params.push(xa_id); }
        if (loai_doi_tuong_id) { sql += ' AND h.loai_doi_tuong_id = ?'; params.push(loai_doi_tuong_id); }
        if (trang_thai_ho) { sql += ' AND h.trang_thai_ho = ?'; params.push(trang_thai_ho); }
        if (vnpt_khu_vuc_id) { sql += ' AND h.vnpt_khu_vuc_id = ?'; params.push(vnpt_khu_vuc_id); }
        if (search) {
            sql += ' AND (h.ten_chu_ho LIKE ? OR h.so_cmnd LIKE ? OR h.ma_ho LIKE ? OR tb.so_thue_bao LIKE ? OR tb.ten_chu_thue_bao LIKE ?)';
            const s = '%' + search + '%';
            params.push(s, s, s, s, s);
        }

        sql += ' GROUP BY h.id';

        if (String(thieu_ho_so || '') === '1') {
            sql += ` HAVING
                SUM(CASE WHEN hs.loai_ho_so = 'giay_chung_nhan_ho_ngheo_can_ngheo' AND ${yearExpr} = YEAR(CURDATE()) THEN 1 ELSE 0 END) = 0
                OR SUM(CASE WHEN hs.loai_ho_so = 'don_dang_ky_su_dung' AND ${yearExpr} = YEAR(CURDATE()) THEN 1 ELSE 0 END) = 0
                OR SUM(CASE WHEN hs.loai_ho_so = 'hop_dong_cung_cap_dv' AND ${yearExpr} = YEAR(CURDATE()) THEN 1 ELSE 0 END) = 0
                OR SUM(CASE WHEN hs.loai_ho_so = 'giay_cccd' AND ${yearExpr} = YEAR(CURDATE()) THEN 1 ELSE 0 END) = 0
                OR SUM(CASE WHEN hs.loai_ho_so = 'giay_cam_ket' AND ${yearExpr} = YEAR(CURDATE()) THEN 1 ELSE 0 END) = 0`;
        }

        sql += ' ORDER BY x.ten_xa, h.ten_chu_ho';
        const [rows] = await pool.query(sql, params);

        const exportRows = (rows || []).map((row, idx) => ({
            'STT': idx + 1,
            'Mã xã': row.ma_xa || '',
            'Tên chủ hộ': row.ten_chu_ho || '',
            'Số CMND/CCCD/Mã số định danh của chủ hộ': row.so_cmnd || '',
            'Tên xã': row.ten_xa || '',
            'Loại đối tượng': row.loai_doi_tuong || '',
            'Dịch vụ viễn thông di động mặt đất': row.dich_vu_di_dong || '',
            'Dịch vụ truy nhập Internet BRCD mặt đất': row.dich_vu_internet_brcd || '',
            'Số/Mã số thuê bao': row.so_thue_bao || '',
            'VNPT Khu vực': row.ten_khu_vuc || ''
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportRows);
        XLSX.utils.book_append_sheet(wb, ws, 'Danh sach ho');

        const fileName = 'danh_sach_ho_' + Date.now() + '.xlsx';
        const filePath = path.join(__dirname, '../../exports', fileName);

        if (!fs.existsSync(path.join(__dirname, '../../exports'))) {
            fs.mkdirSync(path.join(__dirname, '../../exports'), { recursive: true });
        }

        XLSX.writeFile(wb, filePath);
        res.download(filePath, fileName, (err) => {
            if (err) console.error(err);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.exportTemplate = async (req, res) => {
    try {
        const template = [{
            'STT': '',
            'Mã xã': '',
            'Tên chủ hộ': '',
            'Số CMND/CCCD/Mã số định danh của chủ hộ': '',
            'Ngày sinh': '',
            'Giới tính (1: Nam, 0: Nữ)': '',
            'Địa chỉ chi tiết': '',
            'Mã loại đối tượng': '',
            'Ghi chú': '',
            'Mã loại dịch vụ': '',
            'Số/Mã số thuê bao': '',
            'Tên chủ thuê bao': '',
            'CMND chủ thuê bao': '',
            'Gói cước đăng ký': '',
            'Ngày đăng ký': '',
            'Ngày kích hoạt': '',
            'Ngày hết hạn': '',
            'Trạng thái dịch vụ (1: Hoạt động, 0: Chờ kích hoạt)': '',
            'Ghi chú thuê bao': '',
            'Mã VNPT khu vực': '',
        }];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(template);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');

        const fileName = 'template_import.xlsx';
        const filePath = path.join(__dirname, '../../exports', fileName);

        if (!fs.existsSync(path.join(__dirname, '../../exports'))) {
            fs.mkdirSync(path.join(__dirname, '../../exports'), { recursive: true });
        }

        XLSX.writeFile(wb, filePath);
        res.download(filePath, fileName, (err) => {
            if (err) console.error(err);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};