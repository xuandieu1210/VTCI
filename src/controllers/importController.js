// src/controllers/importController.js
const XLSX = require('xlsx');
const ImportLog = require('../models/ImportLog');
const HoGiaDinh = require('../models/HoGiaDinh');
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

const normalizeKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

const getCellValue = (row, keys = []) => {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            const value = row[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                return value;
            }
        }
    }
    return '';
};

const normalizeIdValue = (rawValue) => {
    if (rawValue === undefined || rawValue === null) return '';

    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        return String(Math.trunc(rawValue));
    }

    let value = String(rawValue).trim();
    if (!value) return '';

    // Handle scientific notation exported by Excel, e.g. 4,82E+10 or 4.82E+10
    if (/^[0-9]+([.,][0-9]+)?e[+-]?[0-9]+$/i.test(value)) {
        const normalizedExp = value.replace(',', '.');
        const parsed = Number(normalizedExp);
        if (Number.isFinite(parsed)) {
            return String(Math.trunc(parsed));
        }
    }

    if (/^[0-9]+\.0+$/.test(value)) {
        return value.split('.')[0];
    }

    return value;
};

const toNullableValue = (value) => {
    if (value === undefined || value === null) return null;
    const str = String(value).trim();
    return str === '' ? null : str;
};

const parseExcelDateValue = (rawValue) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') return null;

    if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
        return rawValue.toISOString().slice(0, 10);
    }

    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const parsedDate = new Date(excelEpoch.getTime() + rawValue * 24 * 60 * 60 * 1000);
        if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().slice(0, 10);
        }
    }

    const value = String(rawValue).trim();
    if (!value) return null;

    const ddMmYyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddMmYyyy) {
        const [, d, m, y] = ddMmYyyy;
        const parsedDate = new Date(Number(y), Number(m) - 1, Number(d));
        if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().slice(0, 10);
        }
    }

    const yyyyMmDd = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (yyyyMmDd) {
        const [, y, m, d] = yyyyMmDd;
        const parsedDate = new Date(Number(y), Number(m) - 1, Number(d));
        if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().slice(0, 10);
        }
    }

    const ddMmYyyyDash = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (ddMmYyyyDash) {
        const [, d, m, y] = ddMmYyyyDash;
        const parsedDate = new Date(Number(y), Number(m) - 1, Number(d));
        if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().slice(0, 10);
        }
    }

    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().slice(0, 10);
    }

    return null;
};

const normalizeGender = (rawValue) => {
    const normalizedId = normalizeIdValue(rawValue);
    if (normalizedId === '1') return 'nam';
    if (normalizedId === '0') return 'nu';

    const key = normalizeKey(rawValue);
    if (!key) return null;
    if (key === 'nam' || key === 'male') return 'nam';
    if (key === 'nu' || key === 'female') return 'nu';
    if (key === 'khac' || key === 'other') return 'khac';
    return null;
};

const normalizeHouseholdStatus = (rawValue) => {
    const key = normalizeKey(rawValue);
    const map = {
        dang_hoat_dong: 'dang_hoat_dong',
        danghoatdong: 'dang_hoat_dong',
        hoat_dong: 'dang_hoat_dong',
        hoatdong: 'dang_hoat_dong',
        ngung_hoat_dong: 'ngung_hoat_dong',
        ngunghoatdong: 'ngung_hoat_dong',
        cho_kich_hoat: 'cho_kich_hoat',
        chokichhoat: 'cho_kich_hoat',
        huy_bo: 'huy_bo',
        huybo: 'huy_bo'
    };
    return map[key] || null;
};

const normalizeHoSoStatus = (rawValue) => {
    const key = normalizeKey(rawValue);
    const map = {
        day_du: 'day_du',
        daydu: 'day_du',
        thieu: 'thieu',
        can_bo_sung: 'can_bo_sung',
        canbosung: 'can_bo_sung',
        het_han: 'het_han',
        hethan: 'het_han',
        chua_co: 'chua_co',
        chuaco: 'chua_co'
    };
    return map[key] || null;
};

const normalizeServiceStatus = (rawValue) => {
    const normalizedId = normalizeIdValue(rawValue);
    if (normalizedId === '1') return 'dang_hoat_dong';
    if (normalizedId === '0') return 'cho_kich_hoat';

    const key = normalizeKey(rawValue);
    const map = {
        cho_kich_hoat: 'cho_kich_hoat',
        chokichhoat: 'cho_kich_hoat',
        dang_hoat_dong: 'dang_hoat_dong',
        danghoatdong: 'dang_hoat_dong',
        tam_ngung: 'tam_ngung',
        tamngung: 'tam_ngung',
        da_huy: 'da_huy',
        dahuy: 'da_huy'
    };
    return map[key] || null;
};

const isDifferentPerson = ({ tenA, cmndA, tenB, cmndB }) => {
    const nameA = normalizeKey(tenA);
    const nameB = normalizeKey(tenB);
    const idA = normalizeIdValue(cmndA);
    const idB = normalizeIdValue(cmndB);

    if (idA && idB && idA !== idB) return true;
    if (nameA && nameB && nameA !== nameB) return true;
    return false;
};

exports.importExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Vui long upload file Excel' });
        }

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const results = { success: 0, failed: 0, errors: [] };
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // Get mappings
            const [xas] = await connection.query('SELECT id, ma_xa, ten_xa FROM danh_muc_xa');
            const [loaiDT] = await connection.query('SELECT id, ma_loai, ten_loai FROM loai_doi_tuong');
            const [loaiDichVuRows] = await connection.query('SELECT id, ma_dich_vu, ten_dich_vu FROM loai_dich_vu');
            const [vnptRows] = await connection.query('SELECT id, ma_khu_vuc, ten_khu_vuc FROM vnpt_khu_vuc');

            const xaMap = {};
            xas.forEach(x => {
                xaMap[normalizeKey(x.ten_xa)] = x.id;
                xaMap[normalizeKey(x.ma_xa)] = x.id;
            });

            const loaiMap = {};
            loaiDT.forEach(l => {
                loaiMap[normalizeKey(l.ten_loai)] = l.id;
                loaiMap[normalizeKey(l.ma_loai)] = l.id;
            });

            const loaiDichVuMap = {};
            loaiDichVuRows.forEach(item => {
                loaiDichVuMap[normalizeKey(item.ten_dich_vu)] = item.id;
                loaiDichVuMap[normalizeKey(item.ma_dich_vu)] = item.id;
            });

            const vnptMap = {};
            vnptRows.forEach(item => {
                vnptMap[normalizeKey(item.ten_khu_vuc)] = item.id;
                vnptMap[normalizeKey(item.ma_khu_vuc)] = item.id;
                vnptMap[String(item.id)] = item.id;
            });

            const [defaultLoaiRows] = await connection.query("SELECT id FROM loai_doi_tuong WHERE ma_loai = 'KH' OR LOWER(ten_loai) LIKE '%khac%' LIMIT 1");
            const defaultLoaiId = defaultLoaiRows[0]?.id || null;

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const rowNum = i + 2;

                try {
                    await connection.query('SAVEPOINT row_import');

                    const tenChuHo = String(getCellValue(row, ['Tên chủ hộ', 'Ten chu ho'])).trim();
                    const cmnd = normalizeIdValue(getCellValue(row, ['Số CMND/ CCCD', 'Số CMND/CCCD/Mã số định danh của chủ hộ', 'So CMND/CCCD', 'So CMND/ CCCD']));

                    if (!tenChuHo || !cmnd) {
                        throw new Error('Thieu thong tin bat buoc: Ten chu ho va CMND');
                    }

                    const isDuplicate = await HoGiaDinh.checkDuplicateCMND(cmnd, null, connection);
                    if (isDuplicate) {
                        throw new Error('CMND ' + cmnd + ' da ton tai');
                    }

                    const maXa = normalizeIdValue(getCellValue(row, ['Mã xã', 'Ma xa']));

                    let xaId = xaMap[normalizeKey(maXa)];
                    if (!xaId) {
                        throw new Error('Khong tim thay xa theo ma: ' + maXa);
                    }

                    const maLoai = normalizeIdValue(getCellValue(row, ['Mã loại đối tượng', 'Ma loai doi tuong']));
                    let loaiId = loaiMap[normalizeKey(maLoai)];
                    if (!loaiId) {
                        loaiId = defaultLoaiId;
                    }
                    if (!loaiId) {
                        throw new Error('Khong tim thay loai doi tuong theo ma: ' + (maLoai || '(trong)'));
                    }

                    const vnptMaRaw = normalizeIdValue(getCellValue(row, ['Mã VNPT khu vực', 'Ma VNPT khu vuc']));
                    const vnptId = vnptMap[normalizeKey(vnptMaRaw)] || null;

                    const soThueBao = normalizeIdValue(getCellValue(row, ['Số/Mã số thuê bao', 'So/Ma so thue bao']));
                    const maLoaiDichVu = normalizeIdValue(getCellValue(row, ['Mã loại dịch vụ', 'Ma loai dich vu', 'Mã dịch vụ', 'Ma dich vu']));
                    const loaiDichVuId = loaiDichVuMap[normalizeKey(maLoaiDichVu)] || null;

                    const ngaySinh = parseExcelDateValue(getCellValue(row, ['Ngày sinh', 'Ngay sinh']));
                    const gioiTinh = normalizeGender(getCellValue(row, ['Giới tính (1: Nam, 0: Nữ)', 'Giới tính', 'Gioi tinh (1: Nam, 0: Nu)', 'Gioi tinh']));
                    const diaChiChiTiet = toNullableValue(getCellValue(row, ['Địa chỉ chi tiết', 'Dia chi chi tiet', 'Địa chỉ', 'Dia chi']));
                    const ghiChu = toNullableValue(getCellValue(row, ['Ghi chú', 'Ghi chu']));

                    const tenChuThueBao = toNullableValue(getCellValue(row, ['Tên chủ thuê bao', 'Ten chu thue bao'])) || tenChuHo;
                    const cmndChuThueBao = normalizeIdValue(getCellValue(row, ['CMND chủ thuê bao', 'CCCD chủ thuê bao', 'CMND/CCCD chủ thuê bao', 'Cmnd chu thue bao'])) || cmnd;
                    const goiCuocDangKy = toNullableValue(getCellValue(row, ['Gói cước đăng ký', 'Goi cuoc dang ky']));
                    const ngayDangKy = parseExcelDateValue(getCellValue(row, ['Ngày đăng ký', 'Ngay dang ky']));
                    const ngayKichHoat = parseExcelDateValue(getCellValue(row, ['Ngày kích hoạt', 'Ngay kich hoat']));
                    const ngayHetHan = parseExcelDateValue(getCellValue(row, ['Ngày hết hạn', 'Ngay het han']));
                    const trangThaiDichVu = normalizeServiceStatus(getCellValue(row, ['Trạng thái dịch vụ (1: Hoạt động, 0: Chờ kích hoạt)', 'Trạng thái dịch vụ', 'Trang thai dich vu (1: Hoat dong, 0: Cho kich hoat)', 'Trang thai dich vu']));
                    const ghiChuThueBao = toNullableValue(getCellValue(row, ['Ghi chú thuê bao', 'Ghi chu thue bao']));

                    const hoData = {
                        ten_chu_ho: tenChuHo,
                        so_cmnd: cmnd,
                        xa_id: xaId,
                        loai_doi_tuong_id: loaiId,
                        vnpt_khu_vuc_id: vnptId,
                        ngay_sinh: ngaySinh,
                        gioi_tinh: gioiTinh,
                        dia_chi_chi_tiet: diaChiChiTiet,
                        trang_thai_ho: 'dang_hoat_dong',
                        trang_thai_ho_so: 'chua_co',
                        so_thue_bao_chinh: soThueBao || null,
                        ghi_chu: ghiChu
                    };

                    const hoGiaDinhId = await HoGiaDinh.create(hoData, connection);

                    if (soThueBao) {
                        if (!loaiDichVuId) {
                            throw new Error('Thiếu hoặc không hợp lệ loại dịch vụ cho số thuê bao ' + soThueBao);
                        }

                        const [dupThueBao] = await connection.query('SELECT COUNT(*) AS total FROM thue_bao_dich_vu WHERE so_thue_bao = ?', [soThueBao]);
                        if (Number(dupThueBao[0]?.total || 0) > 0) {
                            throw new Error('So thue bao ' + soThueBao + ' da ton tai');
                        }

                        let thanhVienId = null;
                        const khacChuHo = isDifferentPerson({
                            tenA: tenChuThueBao,
                            cmndA: cmndChuThueBao,
                            tenB: tenChuHo,
                            cmndB: cmnd
                        });

                        if (khacChuHo) {
                            const [existingMembers] = await connection.query(
                                `SELECT id FROM thanh_vien
                                 WHERE ho_gia_dinh_id = ?
                                   AND ((so_cmnd IS NOT NULL AND so_cmnd = ?) OR LOWER(TRIM(ho_ten)) = LOWER(TRIM(?)))
                                 LIMIT 1`,
                                [hoGiaDinhId, cmndChuThueBao || '', tenChuThueBao || '']
                            );

                            if (existingMembers.length > 0) {
                                thanhVienId = existingMembers[0].id;
                            } else {
                                if (cmndChuThueBao) {
                                    const [dupMember] = await connection.query(
                                        'SELECT COUNT(*) AS total FROM thanh_vien WHERE so_cmnd = ?',
                                        [cmndChuThueBao]
                                    );
                                    if (Number(dupMember[0]?.total || 0) > 0) {
                                        throw new Error('CMND/CCCD chu thue bao ' + cmndChuThueBao + ' da ton tai o thanh vien khac');
                                    }
                                }

                                const [insertMember] = await connection.query(
                                    `INSERT INTO thanh_vien (ho_gia_dinh_id, ho_ten, so_cmnd, ngay_sinh, gioi_tinh, quan_he_chu_ho, dung_dich_vu, la_chu_ho_dung_dich_vu)
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [hoGiaDinhId, tenChuThueBao, cmndChuThueBao || null, null, null, 'Khac', 1, 0]
                                );
                                thanhVienId = insertMember.insertId;
                            }
                        }

                        await connection.query(
                            `INSERT INTO thue_bao_dich_vu (ho_gia_dinh_id, thanh_vien_id, loai_dich_vu_id, so_thue_bao, ten_chu_thue_bao, cmnd_chu_thue_bao, goi_cuoc_dang_ky, ngay_dang_ky, ngay_kich_hoat, ngay_het_han, trang_thai_dich_vu, ghi_chu)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [hoGiaDinhId, thanhVienId, loaiDichVuId, soThueBao, tenChuThueBao, cmndChuThueBao, goiCuocDangKy, ngayDangKy || new Date().toISOString().slice(0, 10), ngayKichHoat, ngayHetHan, trangThaiDichVu || 'cho_kich_hoat', ghiChuThueBao]
                        );
                    }

                    results.success++;
                    await connection.query('RELEASE SAVEPOINT row_import');

                } catch (error) {
                    await connection.query('ROLLBACK TO SAVEPOINT row_import').catch(() => {});
                    await connection.query('RELEASE SAVEPOINT row_import').catch(() => {});
                    results.failed++;
                    results.errors.push({ row: rowNum, data: row, error: error.message });
                }
            }

            await connection.commit();

            await ImportLog.create({
                ten_file: req.file.originalname,
                loai_import: 'full',
                tong_so_dong: data.length,
                so_luong_thanh_cong: results.success,
                so_luong_that_bai: results.failed,
                trang_thai: 'thanh_cong',
                loi_chi_tiet: results.errors,
                duong_dan_file_tam: req.file.path,
                nguoi_import_id: req.user?.id
            });

            res.json({
                success: true,
                message: 'Import hoan tat: ' + results.success + ' thanh cong, ' + results.failed + ' that bai',
                data: results
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
            if (req.file.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
        }

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.downloadTemplate = async (req, res) => {
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
            'Mã VNPT khu vực': ''
        }];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(template);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');

        const [xaRows] = await pool.query('SELECT ma_xa, ten_xa FROM danh_muc_xa ORDER BY ten_xa');
        const [loaiDoiTuongRows] = await pool.query('SELECT ma_loai, ten_loai FROM loai_doi_tuong ORDER BY thu_tu_uu_tien, ten_loai');
        const [loaiDichVuRows] = await pool.query('SELECT ma_dich_vu, ten_dich_vu FROM loai_dich_vu ORDER BY ten_dich_vu');
        const [vnptRows] = await pool.query('SELECT ma_khu_vuc, ten_khu_vuc FROM vnpt_khu_vuc ORDER BY ten_khu_vuc');

        const xaSheet = XLSX.utils.json_to_sheet(xaRows.map((item, idx) => ({ STT: idx + 1, ma_xa: item.ma_xa, ten_xa: item.ten_xa })));
        XLSX.utils.book_append_sheet(wb, xaSheet, 'DM_Xa');

        const loaiDoiTuongSheet = XLSX.utils.json_to_sheet(loaiDoiTuongRows.map((item, idx) => ({ STT: idx + 1, ma_loai: item.ma_loai, ten_loai: item.ten_loai })));
        XLSX.utils.book_append_sheet(wb, loaiDoiTuongSheet, 'DM_LoaiDoiTuong');

        const loaiDichVuSheet = XLSX.utils.json_to_sheet(loaiDichVuRows.map((item, idx) => ({ STT: idx + 1, ma_dich_vu: item.ma_dich_vu, ten_dich_vu: item.ten_dich_vu })));
        XLSX.utils.book_append_sheet(wb, loaiDichVuSheet, 'DM_LoaiDichVu');

        const vnptSheet = XLSX.utils.json_to_sheet(vnptRows.map((item, idx) => ({ STT: idx + 1, ma_khu_vuc: item.ma_khu_vuc, ten_khu_vuc: item.ten_khu_vuc })));
        XLSX.utils.book_append_sheet(wb, vnptSheet, 'DM_VNPTKhuVuc');

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

exports.getImportLogs = async (req, res) => {
    try {
        const result = await ImportLog.getAll(req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.exportErrors = async (req, res) => {
    try {
        const { log_id } = req.params;
        const log = await ImportLog.getById(log_id);
        if (!log) {
            return res.status(404).json({ success: false, message: 'Khong tim thay log' });
        }

        const errors = log.loi_chi_tiet || [];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(errors);
        XLSX.utils.book_append_sheet(wb, ws, 'Loi import');

        const fileName = 'errors_import_' + log_id + '.xlsx';
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