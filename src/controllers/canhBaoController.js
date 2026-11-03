// src/controllers/canhBaoController.js
const pool = require('../config/database');

exports.getList = async (req, res) => {
    try {
        const { loai_canh_bao, trang_thai, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        let sql = 'SELECT * FROM canh_bao WHERE 1=1';
        const params = [];

        if (loai_canh_bao) { sql += " AND loai_canh_bao = ?"; params.push(loai_canh_bao); }
        if (trang_thai) { sql += " AND trang_thai = ?"; params.push(trang_thai); }

        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countResult] = await pool.query(countSql, params);
        const total = countResult[0]?.total || 0;

        sql += " ORDER BY do_uu_tien DESC, created_at DESC LIMIT ? OFFSET ?";
        params.push(parseInt(limit), parseInt(offset));
        const [rows] = await pool.query(sql, params);

        res.json({
            success: true,
            data: rows || [],
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDetail = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM canh_bao WHERE id = ?', [req.params.id]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay canh bao' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { loai_canh_bao, mo_ta, do_uu_tien, ho_gia_dinh_id, thanh_vien_id, thue_bao_id } = req.body;
        const sql = `
            INSERT INTO canh_bao 
            (loai_canh_bao, mo_ta, do_uu_tien, ho_gia_dinh_id, thanh_vien_id, thue_bao_id, nguoi_phat_hien_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await pool.query(sql, [
            loai_canh_bao, mo_ta, do_uu_tien || 'trung_binh',
            ho_gia_dinh_id || null, thanh_vien_id || null, thue_bao_id || null,
            req.user?.id || null
        ]);
        const [rows] = await pool.query('SELECT * FROM canh_bao WHERE id = ?', [result.insertId]);
        res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.xuLy = async (req, res) => {
    try {
        const { id } = req.params;
        const { ghi_chu_xu_ly } = req.body;
        const sql = `
            UPDATE canh_bao 
            SET trang_thai = 'da_xu_ly', nguoi_xu_ly_id = ?, ghi_chu_xu_ly = ?, ngay_xu_ly = NOW()
            WHERE id = ?
        `;
        const [result] = await pool.query(sql, [req.user?.id || null, ghi_chu_xu_ly, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay canh bao' });
        }
        res.json({ success: true, message: 'Da xu ly canh bao' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.dong = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('UPDATE canh_bao SET trang_thai = "da_dong" WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Khong tim thay canh bao' });
        }
        res.json({ success: true, message: 'Da dong canh bao' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.kiemTraTuDong = async (req, res) => {
    try {
        const warnings = [];
        const requiredDocTypes = [
            'giay_chung_nhan_ho_ngheo_can_ngheo',
            'don_dang_ky_su_dung',
            'hop_dong_cung_cap_dv',
            'giay_cccd',
            'giay_cam_ket'
        ];

        const ensureWarning = async (loai, mo_ta, doUuTien, ho_gia_dinh_id = null, thanh_vien_id = null, thue_bao_id = null) => {
            const [existing] = await pool.query(
                'SELECT id FROM canh_bao WHERE loai_canh_bao = ? AND mo_ta = ? AND ho_gia_dinh_id <=> ? AND thanh_vien_id <=> ? AND thue_bao_id <=> ? LIMIT 1',
                [loai, mo_ta, ho_gia_dinh_id, thanh_vien_id, thue_bao_id]
            );
            if (existing.length > 0) return false;

            await pool.query(
                `INSERT INTO canh_bao (loai_canh_bao, mo_ta, do_uu_tien, ho_gia_dinh_id, thanh_vien_id, thue_bao_id, nguoi_phat_hien_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [loai, mo_ta, doUuTien, ho_gia_dinh_id, thanh_vien_id, thue_bao_id, req.user?.id || null]
            );
            return true;
        };

        const [columnRows] = await pool.query("SHOW COLUMNS FROM ho_so_dinh_kem LIKE 'nam_ho_so'");
        const hasNamHoSoColumn = columnRows.length > 0;

        const [documents] = hasNamHoSoColumn
            ? await pool.query('SELECT ho_gia_dinh_id, loai_ho_so, nam_ho_so FROM ho_so_dinh_kem')
            : await pool.query('SELECT ho_gia_dinh_id, loai_ho_so, YEAR(created_at) AS nam_ho_so FROM ho_so_dinh_kem');

        const documentsByHousehold = new Map();
        for (const doc of documents || []) {
            const householdId = Number(doc.ho_gia_dinh_id);
            if (!documentsByHousehold.has(householdId)) {
                documentsByHousehold.set(householdId, []);
            }
            documentsByHousehold.get(householdId).push(doc);
        }

        const currentYear = new Date().getFullYear();
        const [households] = await pool.query('SELECT id, ma_ho, ten_chu_ho FROM ho_gia_dinh');

        for (const household of households || []) {
            const docs = documentsByHousehold.get(Number(household.id)) || [];
            const currentYearDocTypes = new Set(
                docs
                    .filter(doc => {
                        const docYear = Number(doc.nam_ho_so);
                        return Number.isInteger(docYear) && docYear === currentYear;
                    })
                    .map(doc => String(doc.loai_ho_so))
            );

            for (const docType of requiredDocTypes) {
                if (!currentYearDocTypes.has(docType)) {
                    const householdLabel = household.ma_ho || household.ten_chu_ho || 'ID ' + household.id;
                    const label = docType === 'giay_chung_nhan_ho_ngheo_can_ngheo'
                        ? 'Giấy chứng nhận hộ nghèo/cận nghèo'
                        : docType.replace(/_/g, ' ');

                    const message = docType === 'giay_chung_nhan_ho_ngheo_can_ngheo'
                        ? 'Hộ ' + householdLabel + ' chưa cập nhật giấy chứng nhận hộ nghèo/cận nghèo năm ' + currentYear
                        : 'Hộ ' + householdLabel + ' thiếu hồ sơ ' + label + ' năm ' + currentYear;

                    const created = await ensureWarning('thieu_ho_so', message, 'cao', household.id);
                    if (created) warnings.push(message);
                }
            }
        }

        const [trungCmnd] = await pool.query(`
            SELECT so_cmnd, COUNT(*) as count
            FROM ho_gia_dinh
            WHERE so_cmnd IS NOT NULL AND so_cmnd != ''
            GROUP BY so_cmnd
            HAVING COUNT(*) > 1
        `);
        for (const item of trungCmnd) {
            const message = 'CMND ' + item.so_cmnd + ' bi trung lap ' + item.count + ' lan';
            const created = await ensureWarning('trung_cmnd', message, 'cao');
            if (created) warnings.push('Trung CMND: ' + item.so_cmnd);
        }

        const [sapHetHan] = await pool.query(`
            SELECT * FROM ho_so_dinh_kem
            WHERE ngay_het_han IS NOT NULL
            AND ngay_het_han BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        `);
        for (const item of sapHetHan) {
            const message = 'Ho so ' + item.ten_file + ' sap het han ngay ' + item.ngay_het_han;
            const created = await ensureWarning('ho_so_sap_het_han', message, 'trung_binh', item.ho_gia_dinh_id);
            if (created) warnings.push('Ho so sap het han: ' + item.ten_file);
        }

        res.json({
            success: true,
            message: 'Da kiem tra tu dong',
            data: { warnings, total: warnings.length }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.thongKe = async (req, res) => {
    try {
        const [byTrangThai] = await pool.query('SELECT trang_thai, COUNT(*) as so_luong FROM canh_bao GROUP BY trang_thai');
        const [byLoai] = await pool.query('SELECT loai_canh_bao, COUNT(*) as so_luong FROM canh_bao GROUP BY loai_canh_bao');
        const [byDoUuTien] = await pool.query('SELECT do_uu_tien, COUNT(*) as so_luong FROM canh_bao GROUP BY do_uu_tien');
        const [total] = await pool.query('SELECT COUNT(*) as tong FROM canh_bao');

        res.json({
            success: true,
            data: {
                byTrangThai: byTrangThai || [],
                byLoai: byLoai || [],
                byDoUuTien: byDoUuTien || [],
                tong: total[0]?.tong || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};