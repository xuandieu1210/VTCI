// src/controllers/thongKeController.js
const pool = require('../config/database');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const REQUIRED_DOC_TYPES = [
    'giay_chung_nhan_ho_ngheo_can_ngheo',
    'don_dang_ky_su_dung',
    'hop_dong_cung_cap_dv',
    'giay_cccd',
    'giay_cam_ket'
];

const parseYear = (raw) => {
    const year = Number(raw);
    if (Number.isInteger(year) && year >= 2000 && year <= 2100) return year;
    return new Date().getFullYear();
};

const parseMonth = (raw) => {
    if (raw === undefined || raw === null || raw === '') return null;
    const month = Number(raw);
    if (Number.isInteger(month) && month >= 1 && month <= 12) return month;
    return null;
};

const buildNewSubscriberQuery = ({ year, month }) => {
    let sql = `
        SELECT
            tb.id,
            tb.so_thue_bao,
            tb.ten_chu_thue_bao,
            tb.cmnd_chu_thue_bao,
            tb.ngay_dang_ky,
            tb.trang_thai_dich_vu,
            tb.created_at,
            ldv.ma_dich_vu,
            ldv.ten_dich_vu,
            h.ma_ho,
            h.ten_chu_ho,
            x.ma_xa,
            x.ten_xa,
            v.ma_khu_vuc,
            v.ten_khu_vuc
        FROM thue_bao_dich_vu tb
        LEFT JOIN loai_dich_vu ldv ON tb.loai_dich_vu_id = ldv.id
        LEFT JOIN ho_gia_dinh h ON tb.ho_gia_dinh_id = h.id
        LEFT JOIN danh_muc_xa x ON h.xa_id = x.id
        LEFT JOIN vnpt_khu_vuc v ON h.vnpt_khu_vuc_id = v.id
        WHERE YEAR(tb.created_at) = ?
    `;
    const params = [year];

    if (month) {
        sql += ' AND MONTH(tb.created_at) = ?';
        params.push(month);
    }

    sql += ' ORDER BY tb.created_at DESC';
    return { sql, params };
};

const getMissingDocRows = async (connection, year) => {
    const [namHoSoColumns] = await connection.query("SHOW COLUMNS FROM ho_so_dinh_kem LIKE 'nam_ho_so'");
    const yearExpr = namHoSoColumns.length > 0 ? 'COALESCE(hs.nam_ho_so, YEAR(hs.created_at))' : 'YEAR(hs.created_at)';

    const missingExpr = REQUIRED_DOC_TYPES.map((docType) =>
        `CASE WHEN SUM(CASE WHEN hs.loai_ho_so = '${docType}' AND ${yearExpr} = ? THEN 1 ELSE 0 END) = 0 THEN 1 ELSE 0 END`
    ).join(' + ');

    const missingNamesExpr = `TRIM(BOTH ', ' FROM CONCAT(${REQUIRED_DOC_TYPES.map((docType) =>
        `CASE WHEN SUM(CASE WHEN hs.loai_ho_so = '${docType}' AND ${yearExpr} = ? THEN 1 ELSE 0 END) = 0 THEN '${docType}, ' ELSE '' END`
    ).join(',')}))`;

    const sql = `
        SELECT
            h.id,
            h.ma_ho,
            h.ten_chu_ho,
            h.so_cmnd,
            x.ma_xa,
            x.ten_xa,
            v.ma_khu_vuc,
            v.ten_khu_vuc,
            ${missingExpr} AS so_loai_ho_so_thieu,
            ${missingNamesExpr} AS ds_loai_ho_so_thieu
        FROM ho_gia_dinh h
        LEFT JOIN danh_muc_xa x ON h.xa_id = x.id
        LEFT JOIN vnpt_khu_vuc v ON h.vnpt_khu_vuc_id = v.id
        LEFT JOIN ho_so_dinh_kem hs ON hs.ho_gia_dinh_id = h.id
        GROUP BY h.id
        HAVING so_loai_ho_so_thieu > 0
        ORDER BY v.ten_khu_vuc, x.ten_xa, h.ten_chu_ho
    `;

    const params = [];
    for (let i = 0; i < REQUIRED_DOC_TYPES.length; i++) params.push(year);
    for (let i = 0; i < REQUIRED_DOC_TYPES.length; i++) params.push(year);

    const [rows] = await connection.query(sql, params);
    return rows || [];
};

exports.getDashboard = async (req, res) => {
    try {
        const [totalHo] = await pool.query('SELECT COUNT(*) as total FROM ho_gia_dinh');
        const [totalXa] = await pool.query('SELECT COUNT(*) as total FROM danh_muc_xa WHERE trang_thai = "dang_hoat_dong"');
        const [totalThueBao] = await pool.query('SELECT COUNT(*) as total FROM thue_bao_dich_vu');
        const [namHoSoColumns] = await pool.query("SHOW COLUMNS FROM ho_so_dinh_kem LIKE 'nam_ho_so'");
        const yearExpr = namHoSoColumns.length > 0 ? 'COALESCE(hs.nam_ho_so, YEAR(hs.created_at))' : 'YEAR(hs.created_at)';
        const requiredDocTypes = [
            'giay_chung_nhan_ho_ngheo_can_ngheo',
            'don_dang_ky_su_dung',
            'hop_dong_cung_cap_dv',
            'giay_cccd',
            'giay_cam_ket'
        ];
        const havingCondition = requiredDocTypes
            .map((docType) => `SUM(CASE WHEN hs.loai_ho_so = '${docType}' AND ${yearExpr} = YEAR(CURDATE()) THEN 1 ELSE 0 END) = 0`)
            .join(' OR ');
        const [thieuHoSo] = await pool.query(`
            SELECT COUNT(*) as total
            FROM (
                SELECT h.id
                FROM ho_gia_dinh h
                LEFT JOIN ho_so_dinh_kem hs ON hs.ho_gia_dinh_id = h.id
                GROUP BY h.id
                HAVING ${havingCondition}
            ) missing_ho_so
        `);
        const [byXa] = await pool.query(`
            SELECT x.ten_xa, COUNT(h.id) as so_luong
            FROM ho_gia_dinh h
            JOIN danh_muc_xa x ON h.xa_id = x.id
            GROUP BY h.xa_id
            ORDER BY x.ten_xa
        `);
        const [byTrangThai] = await pool.query('SELECT trang_thai_ho, COUNT(*) as so_luong FROM ho_gia_dinh GROUP BY trang_thai_ho');
        const [byLoai] = await pool.query(`
            SELECT l.ten_loai, COUNT(h.id) as so_luong
            FROM ho_gia_dinh h
            JOIN loai_doi_tuong l ON h.loai_doi_tuong_id = l.id
            GROUP BY h.loai_doi_tuong_id
        `);

        res.json({
            success: true,
            data: {
                totalHo: totalHo[0]?.total || 0,
                totalXa: totalXa[0]?.total || 0,
                totalThueBao: totalThueBao[0]?.total || 0,
                thieuHoSo: thieuHoSo[0]?.total || 0,
                byXa: byXa || [],
                byTrangThaiHo: byTrangThai || [],
                byLoaiDoiTuong: byLoai || []
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.baoCaoHoGiaDinh = async (req, res) => {
    try {
        const [total] = await pool.query('SELECT COUNT(*) as total FROM ho_gia_dinh');
        const [byXa] = await pool.query(`
            SELECT x.ten_xa, COUNT(h.id) as so_luong
            FROM ho_gia_dinh h
            JOIN danh_muc_xa x ON h.xa_id = x.id
            GROUP BY h.xa_id
        `);
        const [byTrangThai] = await pool.query('SELECT trang_thai_ho, COUNT(*) as so_luong FROM ho_gia_dinh GROUP BY trang_thai_ho');
        const [byLoai] = await pool.query(`
            SELECT l.ten_loai, COUNT(h.id) as so_luong
            FROM ho_gia_dinh h
            JOIN loai_doi_tuong l ON h.loai_doi_tuong_id = l.id
            GROUP BY h.loai_doi_tuong_id
        `);

        res.json({
            success: true,
            data: {
                total: total[0]?.total || 0,
                byXa: byXa || [],
                byTrangThai: byTrangThai || [],
                byLoaiDoiTuong: byLoai || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.baoCaoThueBao = async (req, res) => {
    try {
        const [total] = await pool.query('SELECT COUNT(*) as total FROM thue_bao_dich_vu');
        const [byTrangThai] = await pool.query('SELECT trang_thai_dich_vu, COUNT(*) as so_luong FROM thue_bao_dich_vu GROUP BY trang_thai_dich_vu');
        const [byLoai] = await pool.query(`
            SELECT ldv.ten_dich_vu, COUNT(tb.id) as so_luong
            FROM thue_bao_dich_vu tb
            JOIN loai_dich_vu ldv ON tb.loai_dich_vu_id = ldv.id
            GROUP BY tb.loai_dich_vu_id
        `);
        const [byXa] = await pool.query(`
            SELECT x.ten_xa, COUNT(tb.id) as so_luong
            FROM thue_bao_dich_vu tb
            JOIN ho_gia_dinh h ON tb.ho_gia_dinh_id = h.id
            JOIN danh_muc_xa x ON h.xa_id = x.id
            GROUP BY h.xa_id
        `);

        res.json({
            success: true,
            data: {
                total: total[0]?.total || 0,
                byTrangThai: byTrangThai || [],
                byLoaiDichVu: byLoai || [],
                byXa: byXa || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.baoCaoThueBaoMoi = async (req, res) => {
    try {
        const year = parseYear(req.query.year);
        const month = parseMonth(req.query.month);
        const { sql, params } = buildNewSubscriberQuery({ year, month });
        const [rows] = await pool.query(sql, params);

        res.json({
            success: true,
            data: {
                year,
                month,
                total: rows.length,
                rows: rows || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.baoCaoHoSoThieuTheoKhuVuc = async (req, res) => {
    try {
        const year = parseYear(req.query.year);
        const rows = await getMissingDocRows(pool, year);

        const summaryMap = new Map();
        rows.forEach((item) => {
            const key = String(item.ma_khu_vuc || 'KHONG_XAC_DINH');
            if (!summaryMap.has(key)) {
                summaryMap.set(key, {
                    ma_khu_vuc: item.ma_khu_vuc || '',
                    ten_khu_vuc: item.ten_khu_vuc || 'Khong xac dinh',
                    so_ho_thieu_ho_so: 0
                });
            }
            summaryMap.get(key).so_ho_thieu_ho_so += 1;
        });

        const summary = Array.from(summaryMap.values()).sort((a, b) => b.so_ho_thieu_ho_so - a.so_ho_thieu_ho_so);

        res.json({
            success: true,
            data: {
                year,
                total: rows.length,
                summary,
                rows
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.baoCaoHoSo = async (req, res) => {
    try {
        const [total] = await pool.query('SELECT COUNT(*) as total FROM ho_so_dinh_kem');
        const [byTrangThai] = await pool.query('SELECT trang_thai, COUNT(*) as so_luong FROM ho_so_dinh_kem GROUP BY trang_thai');
        const [byLoai] = await pool.query('SELECT loai_ho_so, COUNT(*) as so_luong FROM ho_so_dinh_kem GROUP BY loai_ho_so');
        const [sapHetHan] = await pool.query(`
            SELECT COUNT(*) as so_luong
            FROM ho_so_dinh_kem
            WHERE ngay_het_han IS NOT NULL 
            AND ngay_het_han BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        `);
        const [daHetHan] = await pool.query(`
            SELECT COUNT(*) as so_luong
            FROM ho_so_dinh_kem
            WHERE ngay_het_han IS NOT NULL 
            AND ngay_het_han < CURDATE()
        `);

        res.json({
            success: true,
            data: {
                total: total[0]?.total || 0,
                byTrangThai: byTrangThai || [],
                byLoaiHoSo: byLoai || [],
                sapHetHan: sapHetHan[0]?.so_luong || 0,
                daHetHan: daHetHan[0]?.so_luong || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.exportBaoCao = async (req, res) => {
    try {
        const { loai } = req.params;
        const year = parseYear(req.query.year);
        const month = parseMonth(req.query.month);

        const wb = XLSX.utils.book_new();

        if (loai === 'thue-bao-moi') {
            const { sql, params } = buildNewSubscriberQuery({ year, month });
            const [rows] = await pool.query(sql, params);

            const exportRows = (rows || []).map((item, index) => ({
                STT: index + 1,
                ma_khu_vuc: item.ma_khu_vuc || '',
                ten_khu_vuc: item.ten_khu_vuc || '',
                ma_xa: item.ma_xa || '',
                ten_xa: item.ten_xa || '',
                ma_ho: item.ma_ho || '',
                ten_chu_ho: item.ten_chu_ho || '',
                so_thue_bao: item.so_thue_bao || '',
                ten_chu_thue_bao: item.ten_chu_thue_bao || '',
                cmnd_chu_thue_bao: item.cmnd_chu_thue_bao || '',
                ma_dich_vu: item.ma_dich_vu || '',
                ten_dich_vu: item.ten_dich_vu || '',
                ngay_dang_ky: item.ngay_dang_ky || '',
                created_at: item.created_at || '',
                trang_thai_dich_vu: item.trang_thai_dich_vu || ''
            }));

            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportRows), 'ThueBaoMoi');
        } else if (loai === 'ho-so-thieu-khu-vuc') {
            const rows = await getMissingDocRows(pool, year);
            const summaryMap = new Map();
            rows.forEach((item) => {
                const key = String(item.ma_khu_vuc || 'KHONG_XAC_DINH');
                if (!summaryMap.has(key)) {
                    summaryMap.set(key, {
                        ma_khu_vuc: item.ma_khu_vuc || '',
                        ten_khu_vuc: item.ten_khu_vuc || 'Khong xac dinh',
                        so_ho_thieu_ho_so: 0
                    });
                }
                summaryMap.get(key).so_ho_thieu_ho_so += 1;
            });

            const summaryRows = Array.from(summaryMap.values()).sort((a, b) => b.so_ho_thieu_ho_so - a.so_ho_thieu_ho_so);
            const detailRows = (rows || []).map((item, index) => ({
                STT: index + 1,
                ma_khu_vuc: item.ma_khu_vuc || '',
                ten_khu_vuc: item.ten_khu_vuc || '',
                ma_xa: item.ma_xa || '',
                ten_xa: item.ten_xa || '',
                ma_ho: item.ma_ho || '',
                ten_chu_ho: item.ten_chu_ho || '',
                so_cmnd: item.so_cmnd || '',
                so_loai_ho_so_thieu: item.so_loai_ho_so_thieu || 0,
                ds_loai_ho_so_thieu: item.ds_loai_ho_so_thieu || ''
            }));

            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'TongHopKhuVuc');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'ChiTietHoThieu');
        } else {
            return res.status(400).json({ success: false, message: 'Loai bao cao khong hop le' });
        }

        const fileName = 'bao_cao_' + loai + '_' + Date.now() + '.xlsx';
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