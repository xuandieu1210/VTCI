// src/routes/webRoutes.js
const express = require('express');
const router = express.Router();
const { requireLogin, requireRole } = require('../middlewares/auth');
const pool = require('../config/database');
const axios = require('axios');
const { REQUIRED_DOCUMENT_TYPES, missingDocumentAggregate, householdDocumentStatus } = require('../utils/documentStatus');

const pageSizes = [10, 20, 50, 100];
const getPageSize = (value) => pageSizes.includes(Number(value)) ? Number(value) : 20;

async function reviewDocuments(ids, status, reason = null) {
    const connection = await pool.getConnection();
    const placeholders = ids.map(() => '?').join(',');
    try {
        await connection.beginTransaction();
        await connection.query(`SELECT id FROM ho_gia_dinh WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`, ids);
        const [result] = await connection.query(`
            UPDATE ho_gia_dinh h
            SET trang_thai_ho_so = ?, nam_xet_duyet = EXTRACT(YEAR FROM CURRENT_DATE)::integer, ly_do_tu_choi = ?, updated_at = NOW()
            WHERE h.id IN (${placeholders}) AND ${householdDocumentStatus('h')} = 'cho_duyet'
        `, [status, reason, ...ids]);
        await connection.commit();
        return result.affectedRows;
    } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
    } finally {
        connection.release();
    }
}

axios.interceptors.request.use((config) => {
    const targetPort = process.env.PORT || 3000;
    if (typeof config.url === 'string') {
        config.url = config.url.replace('http://localhost:3000', 'http://127.0.0.1:' + targetPort);
    }
    return config;
});

router.use(async (req, res, next) => {
    try {
        if (req.session && req.session.user) {
            const [rows] = await pool.query('SELECT COUNT(*) AS total FROM ho_gia_dinh');
            res.locals.householdCount = Number(rows[0]?.total || 0);
        } else {
            res.locals.householdCount = 0;
        }
    } catch (error) {
        res.locals.householdCount = 0;
    }
    next();
});

const normalizeText = (value) => String(value || '').trim();
const normalizeRole = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const hasRole = (user, ...roles) => {
    if (!user) return false;
    const currentRole = normalizeRole(user.vai_tro || user.role);
    return roles.some(role => normalizeRole(role) === currentRole);
};
const normalizeRelationText = (value) => normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

const isChuHoRelation = (value) => normalizeRelationText(value).includes('chu ho');
const parseDateValue = (value) => {
    const v = normalizeText(value);
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

const validateServiceDateOrder = (service, rowIndex) => {
    const ngayDangKy = parseDateValue(service.ngay_dang_ky);
    const ngayKichHoat = parseDateValue(service.ngay_kich_hoat);
    const ngayHetHan = parseDateValue(service.ngay_het_han);
    const row = rowIndex + 1;

    if (ngayDangKy && ngayKichHoat && ngayKichHoat < ngayDangKy) {
        throw new Error('Dong thue bao ' + row + ': Ngay kich hoat khong duoc truoc ngay dang ky');
    }

    if (ngayDangKy && ngayHetHan && ngayHetHan < ngayDangKy) {
        throw new Error('Dong thue bao ' + row + ': Ngay het han khong duoc truoc ngay dang ky');
    }

    if (ngayKichHoat && ngayHetHan && ngayHetHan < ngayKichHoat) {
        throw new Error('Dong thue bao ' + row + ': Ngay het han khong duoc truoc ngay kich hoat');
    }
};

const validateCreateEditPayload = ({ householdPayload, members, serviceLines }) => {
    const cmndSet = new Set();
    const thueBaoSet = new Set();
    const householdCmnd = normalizeText(householdPayload.so_cmnd);

    for (let i = 0; i < (members || []).length; i += 1) {
        const member = members[i] || {};
        const cmnd = normalizeText(member.so_cmnd);
        if (!cmnd) continue;

        if (cmndSet.has(cmnd)) {
            throw new Error('CCCD/CMND bi trung trong danh sach thanh vien: ' + cmnd);
        }
        cmndSet.add(cmnd);
    }

    for (let i = 0; i < (serviceLines || []).length; i += 1) {
        const service = serviceLines[i] || {};
        const soThueBao = normalizeText(service.so_thue_bao);
        if (soThueBao) {
            if (thueBaoSet.has(soThueBao)) {
                throw new Error('So thue bao bi trung trong du lieu nhap: ' + soThueBao);
            }
            thueBaoSet.add(soThueBao);
        }
        validateServiceDateOrder(service, i);
    }

    if (householdCmnd) {
        const duplicateMemberCmnd = (members || []).some((member) => {
            const memberCmnd = normalizeText(member && member.so_cmnd);
            const relation = normalizeRelationText(member && member.quan_he_chu_ho);
            return memberCmnd && memberCmnd === householdCmnd && !relation.includes('chu ho');
        });
        if (duplicateMemberCmnd) {
            throw new Error('CCCD/CMND chu ho trung voi thanh vien khac chu ho');
        }
    }
};

const stripEmptyFields = (payload) => {
    const clean = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
        if (value === '' || value === undefined || value === null) return;
        clean[key] = value;
    });
    return clean;
};

const resolveThanhVienId = (memberRef, members = [], createdMemberIds = {}) => {
    if (memberRef === undefined || memberRef === null || memberRef === '' || memberRef === '__chu_ho__') {
        return null;
    }

    const refText = String(memberRef);
    const refNumber = Number(refText);

    if (Number.isFinite(refNumber) && Object.prototype.hasOwnProperty.call(createdMemberIds, refNumber)) {
        return createdMemberIds[refNumber] || null;
    }

    const memberById = (members || []).find((member) => String(member?.id || '') === refText);
    if (memberById && memberById.id) {
        return Number(memberById.id);
    }

    if (Number.isFinite(refNumber) && members[refNumber] && members[refNumber].id) {
        return Number(members[refNumber].id);
    }

    if (Number.isFinite(refNumber) && Object.prototype.hasOwnProperty.call(createdMemberIds, refNumber)) {
        return createdMemberIds[refNumber] || null;
    }

    return null;
};

const resolveMemberFromRef = (memberRef, members = [], createdMemberIds = {}) => {
    const resolvedId = resolveThanhVienId(memberRef, members, createdMemberIds);
    if (resolvedId) {
        const memberById = (members || []).find((member) => String(member?.id || '') === String(resolvedId));
        if (memberById) {
            return memberById;
        }
        return { id: resolvedId };
    }

    if (memberRef === undefined || memberRef === null || memberRef === '' || memberRef === '__chu_ho__') {
        return null;
    }

    const refNumber = Number(memberRef);
    if (Number.isFinite(refNumber) && members[refNumber]) {
        return members[refNumber];
    }

    return null;
};

const resolveThonIdFromText = async () => null;

// ====== DASHBOARD ======
router.get('/', requireLogin, async (req, res) => {
    try {
        const token = req.session.token;
        const response = await axios.get('http://localhost:3000/api/thong-ke/dashboard', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        res.render('pages/dashboard', {
            title: 'Dashboard - Quan ly vien thong cong ich',
            user: req.session.user,
            stats: response.data.data || {}
        });
    } catch (error) {
        res.render('pages/dashboard', {
            title: 'Dashboard',
            user: req.session.user,
            stats: {}
        });
    }
});

// ====== LOGIN ======
router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('pages/login', { title: 'Dang nhap', error: null, user: null });
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const response = await axios.post('http://localhost:3000/api/auth/login', { username, password });
        if (response.data.success) {
            req.session.user = response.data.data.user;
            req.session.token = response.data.data.token;
            return res.redirect('/');
        }
        res.render('pages/login', { title: 'Dang nhap', error: response.data.message || 'Ten dang nhap hoac mat khau khong dung', user: null });
    } catch (error) {
        const message = error?.response?.data?.message || 'Ten dang nhap hoac mat khau khong dung';
        res.render('pages/login', { title: 'Dang nhap', error: message, user: null });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ====== HO GIA DINH ======
router.get('/ho-gia-dinh', requireLogin, async (req, res) => {
    try {
        const page = Number.isSafeInteger(Number(req.query.page)) && Number(req.query.page) > 0 ? Number(req.query.page) : 1;
        const limit = getPageSize(req.query.limit);
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const xaId = req.query.xa_id || '';
        const vnptKhuVucId = req.query.vnpt_khu_vuc_id || '';
        const thieuHoSoOnly = String(req.query.thieu_ho_so || '') === '1';
        const trangThaiHoSo = String(req.query.trang_thai_ho_so || '');
        const token = req.session.token;
        let listData = [];
        let listPagination = {};
        const [xaRes, vnptRes] = await Promise.all([
            axios.get('http://localhost:3000/api/danh-muc/xa', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } }),
            axios.get('http://localhost:3000/api/danh-muc/vnpt-khu-vuc', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } })
        ]);

        if (thieuHoSoOnly) {
            const havingCondition = REQUIRED_DOCUMENT_TYPES
                .map((docType) => missingDocumentAggregate(docType, 'EXTRACT(YEAR FROM CURRENT_DATE)'))
                .join(' OR ');

            let whereSql = 'WHERE 1=1';
            const whereParams = [];
            if (search) {
                whereSql += ' AND (h.ten_chu_ho ILIKE ? OR h.so_cmnd ILIKE ? OR h.ma_ho ILIKE ? OR tb.so_thue_bao ILIKE ? OR tb.ten_chu_thue_bao ILIKE ?)';
                const s = '%' + search + '%';
                whereParams.push(s, s, s, s, s);
            }
            if (xaId) { whereSql += ' AND h.xa_id = ?'; whereParams.push(xaId); }
            if (vnptKhuVucId) { whereSql += ' AND h.vnpt_khu_vuc_id = ?'; whereParams.push(vnptKhuVucId); }
            if (trangThaiHoSo) { whereSql += ` AND ${householdDocumentStatus('h')} = ?`; whereParams.push(trangThaiHoSo); }

            const baseSql = `
                FROM ho_gia_dinh h
                LEFT JOIN danh_muc_xa x ON h.xa_id = x.id
                LEFT JOIN loai_doi_tuong l ON h.loai_doi_tuong_id = l.id
                LEFT JOIN vnpt_khu_vuc v ON h.vnpt_khu_vuc_id = v.id
                LEFT JOIN thue_bao_dich_vu tb ON tb.ho_gia_dinh_id = h.id
                LEFT JOIN loai_dich_vu ldv ON tb.loai_dich_vu_id = ldv.id
                LEFT JOIN ho_so_dinh_kem hs ON hs.ho_gia_dinh_id = h.id
                ${whereSql}
                GROUP BY h.id, x.id, l.id, v.id
                HAVING ${havingCondition}
            `;

            const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM (SELECT h.id ${baseSql}) q`, whereParams);
            const total = countRows[0]?.total || 0;
            const [rows] = await pool.query(
                `SELECT
                    h.*, ${householdDocumentStatus('h')} AS trang_thai_ho_so, x.ma_xa, x.ten_xa, x.ten_xa_cu,
                    l.ten_loai AS ten_loai_doi_tuong,
                    v.ten_khu_vuc,
                    MAX(tb.so_thue_bao) AS so_thue_bao,
                    CASE WHEN SUM(CASE WHEN LOWER(TRIM(COALESCE(ldv.loai_hinh, ''))) IN ('di_dong_mat_dat', 'vien_thong_di_dong_mat_dat') OR LOWER(TRIM(COALESCE(ldv.ma_dich_vu, ''))) IN ('dmdd', 'dd') THEN 1 ELSE 0 END) > 0 THEN 'x' ELSE '' END AS dich_vu_di_dong,
                    CASE WHEN SUM(CASE WHEN LOWER(TRIM(COALESCE(ldv.loai_hinh, ''))) IN ('internet_brcd', 'truy_nhap_internet_brcd_mat_dat', 'brcd') OR LOWER(TRIM(COALESCE(ldv.ma_dich_vu, ''))) IN ('ibrcd', 'br') THEN 1 ELSE 0 END) > 0 THEN 'x' ELSE '' END AS dich_vu_internet_brcd
                 ${baseSql} ORDER BY h.created_at DESC LIMIT ? OFFSET ?`,
                [...whereParams, limit, offset]
            );

            listData = rows || [];
            listPagination = { page, limit, total, totalPages: Math.ceil(total / limit) };
        } else {
            const query = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                search,
                xa_id: xaId,
                vnpt_khu_vuc_id: vnptKhuVucId,
                trang_thai_ho_so: trangThaiHoSo
            }).toString();
            const listRes = await axios.get('http://localhost:3000/api/ho-gia-dinh?' + query, { headers: { 'Authorization': 'Bearer ' + token } });
            listData = listRes.data.data || [];
            listPagination = listRes.data.pagination || {};
        }

        let xaList = Array.isArray(xaRes.data?.data) ? xaRes.data.data : [];
        if (!xaList.length) {
            const [xaRows] = await pool.query('SELECT * FROM danh_muc_xa WHERE trang_thai IS NULL OR trang_thai <> ? ORDER BY ten_xa', ['ngung_hoat_dong']);
            xaList = xaRows || [];
        }

        let vnptKhuVucList = Array.isArray(vnptRes.data?.data) ? vnptRes.data.data : [];
        if (!vnptKhuVucList.length) {
            const [vnptRows] = await pool.query('SELECT * FROM vnpt_khu_vuc ORDER BY ten_khu_vuc');
            vnptKhuVucList = vnptRows || [];
        }

        const successMessage = req.query.created === '1'
            ? 'Tạo hộ gia đình thành công'
            : req.query.deleted === '1'
                ? 'Xóa hộ gia đình thành công'
                : null;

        res.render('pages/ho-gia-dinh/index', {
            title: 'Quan ly ho gia dinh',
            user: req.session.user,
            data: listData,
            pagination: listPagination,
            search,
            xaId,
            vnptKhuVucId,
            thieuHoSoOnly,
            trangThaiHoSo,
            xaList,
            vnptKhuVucList,
            successMessage
        });
    } catch (error) {
        const [xaFallback] = await pool.query('SELECT * FROM danh_muc_xa WHERE trang_thai IS NULL OR trang_thai <> ? ORDER BY ten_xa', ['ngung_hoat_dong']);
        const [vnptFallback] = await pool.query('SELECT * FROM vnpt_khu_vuc ORDER BY ten_khu_vuc');

        res.render('pages/ho-gia-dinh/index', {
            title: 'Quan ly ho gia dinh',
            user: req.session.user,
            data: [],
            pagination: {},
            search: '',
            xaId: '',
            vnptKhuVucId: '',
            thieuHoSoOnly: false,
            trangThaiHoSo: '',
            xaList: xaFallback || [],
            vnptKhuVucList: vnptFallback || [],
            successMessage: null
        });
    }
});

router.get('/ho-gia-dinh/create', requireLogin, requireRole('admin', 'manager', 'vnpt_khu_vuc'), async (req, res) => {
    try {
        const token = req.session.token;
        const [xaRes, vnptRes, loaiRes, loaiDichVuRes] = await Promise.all([
            axios.get('http://localhost:3000/api/danh-muc/xa', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } }),
            axios.get('http://localhost:3000/api/danh-muc/vnpt-khu-vuc', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } }),
            axios.get('http://localhost:3000/api/danh-muc/loai-doi-tuong', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } }),
            axios.get('http://localhost:3000/api/danh-muc/loai-dich-vu', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } })
        ]);
        res.render('pages/ho-gia-dinh/create', {
            title: 'Them moi ho gia dinh',
            user: req.session.user,
            xaList: xaRes.data.data || [],
            vnptKhuVucList: vnptRes.data.data || [],
            loaiList: loaiRes.data.data || [],
            loaiDichVuList: loaiDichVuRes.data.data || [],
            error: null,
            oldData: {}
        });
    } catch (error) {
        res.render('pages/ho-gia-dinh/create', {
            title: 'Them moi ho gia dinh',
            user: req.session.user,
            xaList: [],
            vnptKhuVucList: [],
            loaiList: [],
            loaiDichVuList: [],
            error: 'Loi tai du lieu',
            oldData: {}
        });
    }
});

router.get('/ho-gia-dinh/:id', requireLogin, async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.session.token;
        const [hoRes, xaRes, vnptRes] = await Promise.all([
            axios.get('http://localhost:3000/api/ho-gia-dinh/' + id, { headers: { 'Authorization': 'Bearer ' + token } }),
            axios.get('http://localhost:3000/api/danh-muc/xa', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } }),
            axios.get('http://localhost:3000/api/danh-muc/vnpt-khu-vuc', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } })
        ]);

        if (!hoRes.data?.data) {
            return res.redirect('/ho-gia-dinh');
        }

        res.render('pages/ho-gia-dinh/detail', {
            title: 'Chi tiet ho gia dinh',
            user: req.session.user,
            ho: hoRes.data.data,
            xaList: xaRes.data.data || [],
            vnptKhuVucList: vnptRes.data.data || [],
            error: null
        });
    } catch (error) {
        res.redirect('/ho-gia-dinh/' + id + '/edit?updated=1');
    }
});

router.post('/ho-gia-dinh/create', requireLogin, requireRole('admin', 'manager', 'vnpt_khu_vuc'), async (req, res) => {
    try {
        const token = req.session.token;
        if (hasRole(req.session.user, 'vnpt_khu_vuc')) {
            req.body.vnpt_khu_vuc_id = req.session.user.vnpt_khu_vuc_id;
        }
        const isAjaxRequest = req.headers['x-requested-with'] === 'XMLHttpRequest' || (req.headers.accept || '').includes('application/json');
        const rawMembers = req.body.thanh_vien || {};
        const members = Array.isArray(rawMembers) ? rawMembers : Object.values(rawMembers);
        const rawServiceLines = req.body.thue_bao || {};
        const serviceLines = Array.isArray(rawServiceLines) ? rawServiceLines : Object.values(rawServiceLines);
        const householdPayload = { ...req.body };
        const ownerMode = req.body.nguoi_dung_dich_vu || (req.body.chu_ho_dung_dich_vu === '1' ? 'chu_ho' : 'thanh_vien');
        delete householdPayload.thanh_vien;
        delete householdPayload.chu_ho_dung_dich_vu;
        delete householdPayload.nguoi_dung_dich_vu;
        delete householdPayload.thue_bao;

        validateCreateEditPayload({ householdPayload, members, serviceLines });

        const response = await axios.post('http://localhost:3000/api/ho-gia-dinh', householdPayload, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        const householdId = response.data?.data?.id;
        if (householdId) {
            const normalizedMembers = members.filter(member => member && ((member.ho_ten || '').trim() || (member.so_cmnd || '').trim() || (member.quan_he_chu_ho || '').trim()));
            const createdMemberIds = {};

            if (ownerMode === 'chu_ho') {
                const existingHead = normalizedMembers.find(member => isChuHoRelation(member.quan_he_chu_ho) || normalizeText(member.ho_ten).toLowerCase() === normalizeText(householdPayload.ten_chu_ho).toLowerCase() || normalizeText(member.so_cmnd) === normalizeText(householdPayload.so_cmnd));
                if (existingHead) {
                    existingHead.la_chu_ho_dung_dich_vu = true;
                    existingHead.dung_dich_vu = true;
                } else {
                    normalizedMembers.unshift({
                        ho_ten: householdPayload.ten_chu_ho || '',
                        so_cmnd: householdPayload.so_cmnd || '',
                        quan_he_chu_ho: 'Chủ hộ',
                        dung_dich_vu: true,
                        la_chu_ho_dung_dich_vu: true
                    });
                }
            }

            for (const [memberIndex, member] of normalizedMembers.entries()) {
                const memberName = (member.ho_ten || '').trim();
                const memberCmnd = (member.so_cmnd || '').trim();
                if (!memberName && !memberCmnd) continue;

                const memberPayload = {
                    ...member,
                    ho_gia_dinh_id: householdId,
                    dung_dich_vu: member.dung_dich_vu === '1' || member.dung_dich_vu === true || member.dung_dich_vu === 1,
                    la_chu_ho_dung_dich_vu: member.la_chu_ho_dung_dich_vu === '1' || member.la_chu_ho_dung_dich_vu === true || member.la_chu_ho_dung_dich_vu === 1
                };

                const memberResponse = await axios.post('http://localhost:3000/api/ho-gia-dinh/' + householdId + '/thanh-vien', memberPayload, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (memberResponse.data?.data?.id) {
                    createdMemberIds[memberIndex] = memberResponse.data.data.id;
                }
            }

            for (const service of serviceLines) {
                const soThueBao = (service.so_thue_bao || '').trim();
                if (!soThueBao) continue;
                const selectedMemberRef = service.thanh_vien_ref ?? service.thanh_vien_id;
                const isHouseholdOwner = ownerMode === 'chu_ho' || selectedMemberRef === '__chu_ho__';
                const mappedMemberId = resolveThanhVienId(selectedMemberRef, normalizedMembers, createdMemberIds);
                const finalTenChuThueBao = isHouseholdOwner ? (householdPayload.ten_chu_ho || service.ten_chu_thue_bao || '') : (service.ten_chu_thue_bao || (normalizedMembers[Number(selectedMemberRef)]?.ho_ten || ''));
                const finalCmndChuThueBao = isHouseholdOwner ? (householdPayload.so_cmnd || service.cmnd_chu_thue_bao || '') : (service.cmnd_chu_thue_bao || (normalizedMembers[Number(selectedMemberRef)]?.so_cmnd || ''));
                await axios.post('http://localhost:3000/api/ho-gia-dinh/' + householdId + '/thue-bao', {
                    ...service,
                    ho_gia_dinh_id: householdId,
                    loai_dich_vu_id: service.loai_dich_vu_id || null,
                    so_thue_bao: soThueBao,
                    thanh_vien_id: mappedMemberId,
                    ten_chu_thue_bao: finalTenChuThueBao,
                    cmnd_chu_thue_bao: finalCmndChuThueBao,
                    ngay_dang_ky: service.ngay_dang_ky || null,
                    ngay_kich_hoat: service.ngay_kich_hoat || null,
                    ngay_het_han: service.ngay_het_han || null,
                    trang_thai_dich_vu: service.trang_thai_dich_vu || 'cho_kich_hoat'
                }, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
            }
        }

        if (isAjaxRequest) {
            return res.json({ success: true, message: 'Tao ho thanh cong', householdId: householdId || null });
        }

        res.redirect('/ho-gia-dinh');
    } catch (error) {
        if (req.headers['x-requested-with'] === 'XMLHttpRequest' || (req.headers.accept || '').includes('application/json')) {
            return res.status(400).json({ success: false, message: error.response?.data?.message || 'Loi them moi' });
        }

        res.render('pages/ho-gia-dinh/create', {
            title: 'Them moi ho gia dinh',
            user: req.session.user,
            xaList: [],
            loaiList: [],
            loaiDichVuList: [],
            error: error.response?.data?.message || 'Loi them moi',
            oldData: req.body
        });
    }
});

router.get('/ho-gia-dinh/:id/edit', requireLogin, requireRole('admin', 'manager', 'vnpt_khu_vuc'), async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.session.token;
        const isVnptUser = hasRole(req.session.user, 'vnpt_khu_vuc');
        const userAreaId = Number(req.session.user?.vnpt_khu_vuc_id || 0);
        const [hoRes, xaRes, vnptRes, loaiRes, loaiDichVuRes] = await Promise.all([
            axios.get('http://localhost:3000/api/ho-gia-dinh/' + id, { headers: { 'Authorization': 'Bearer ' + token } }),
            axios.get('http://localhost:3000/api/danh-muc/xa', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } }),
            axios.get('http://localhost:3000/api/danh-muc/vnpt-khu-vuc', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } }),
            axios.get('http://localhost:3000/api/danh-muc/loai-doi-tuong', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } }),
            axios.get('http://localhost:3000/api/danh-muc/loai-dich-vu', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } })
        ]);

        if (isVnptUser && hoRes.data?.data && Number(hoRes.data.data.vnpt_khu_vuc_id) !== Number(req.session.user.vnpt_khu_vuc_id)) {
            return res.status(403).render('pages/error', {
                title: 'Khong co quyen',
                message: 'Bạn chỉ được sửa hộ gia đình thuộc khu vực VNPT của mình',
                user: req.session.user
            });
        }

        let xaList = Array.isArray(xaRes.data?.data) ? xaRes.data.data : [];
        if (isVnptUser && userAreaId) {
            const allXaList = Array.isArray(xaRes.data?.data) ? xaRes.data.data : [];
            const householdXaId = Number(hoRes.data?.data?.xa_id || 0);
            xaList = allXaList.filter(item => Number(item.vnpt_khu_vuc_id) === userAreaId || Number(item.id) === householdXaId || !item.vnpt_khu_vuc_id);
            if (!xaList.length) {
                xaList = allXaList;
            }
        }

        res.render('pages/ho-gia-dinh/edit', {
            title: 'Sua ho gia dinh',
            user: req.session.user,
            token: token,
            ho: hoRes.data.data || {},
            xaList,
            vnptKhuVucList: vnptRes.data.data || [],
            loaiList: loaiRes.data.data || [],
            loaiDichVuList: loaiDichVuRes.data.data || [],
            error: null,
            successMessage: req.query.updated === '1' ? 'Cap nhat ho gia dinh thanh cong' : null
        });
    } catch (error) {
        res.redirect('/ho-gia-dinh');
    }
});

router.post('/ho-gia-dinh/:id/edit', requireLogin, requireRole('admin', 'manager', 'vnpt_khu_vuc'), async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.session.token;
        if (hasRole(req.session.user, 'vnpt_khu_vuc')) {
            req.body.vnpt_khu_vuc_id = req.session.user.vnpt_khu_vuc_id;
        }
        const currentHouseholdRes = await axios.get('http://localhost:3000/api/ho-gia-dinh/' + id, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const currentStatus = String(currentHouseholdRes.data?.data?.trang_thai_ho_so || '');
        const rawMembers = req.body.thanh_vien || {};
        const members = Array.isArray(rawMembers) ? rawMembers : Object.values(rawMembers);
        const rawServiceLines = req.body.thue_bao || {};
        const serviceLines = Array.isArray(rawServiceLines) ? rawServiceLines : Object.values(rawServiceLines);
        const householdPayload = { ...req.body };
        const ownerMode = req.body.nguoi_dung_dich_vu || (req.body.chu_ho_dung_dich_vu === '1' ? 'chu_ho' : 'thanh_vien');
        delete householdPayload.thanh_vien;
        delete householdPayload.chu_ho_dung_dich_vu;
        delete householdPayload.nguoi_dung_dich_vu;
        delete householdPayload.thue_bao;
        delete householdPayload.trang_thai_ho_so;
        delete householdPayload.ly_do_tu_choi;
        const cleanHouseholdPayload = stripEmptyFields(householdPayload);

        if (currentStatus === 'tu_choi') {
            cleanHouseholdPayload.trang_thai_ho_so = 'can_bo_sung';
            cleanHouseholdPayload.ly_do_tu_choi = null;
        }

        validateCreateEditPayload({ householdPayload, members, serviceLines });

        await axios.put('http://localhost:3000/api/ho-gia-dinh/' + id, cleanHouseholdPayload, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        const normalizedMembers = members.filter(member => member && ((member.ho_ten || '').trim() || (member.so_cmnd || '').trim() || (member.quan_he_chu_ho || '').trim()));
        const createdMemberIds = {};
        if (ownerMode === 'chu_ho') {
            const headMember = normalizedMembers.find(member => isChuHoRelation(member.quan_he_chu_ho) || normalizeText(member.ho_ten).toLowerCase() === normalizeText(householdPayload.ten_chu_ho).toLowerCase() || normalizeText(member.so_cmnd) === normalizeText(householdPayload.so_cmnd));
            if (headMember) {
                headMember.la_chu_ho_dung_dich_vu = true;
                headMember.dung_dich_vu = true;
            } else {
                normalizedMembers.unshift({
                    ho_ten: householdPayload.ten_chu_ho || '',
                    so_cmnd: householdPayload.so_cmnd || '',
                    quan_he_chu_ho: 'Chủ hộ',
                    dung_dich_vu: true,
                    la_chu_ho_dung_dich_vu: true
                });
            }
        }

        for (const [memberIndex, member] of normalizedMembers.entries()) {
            const memberName = (member.ho_ten || '').trim();
            const memberCmnd = (member.so_cmnd || '').trim();
            if (!memberName && !memberCmnd) continue;

            const memberPayload = stripEmptyFields({
                ...member,
                dung_dich_vu: member.dung_dich_vu === '1' || member.dung_dich_vu === true || member.dung_dich_vu === 1,
                la_chu_ho_dung_dich_vu: member.la_chu_ho_dung_dich_vu === '1' || member.la_chu_ho_dung_dich_vu === true || member.la_chu_ho_dung_dich_vu === 1
            });

            if (member.id) {
                await axios.put('http://localhost:3000/api/thanh-vien/' + member.id, memberPayload, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
            } else {
                const memberResponse = await axios.post('http://localhost:3000/api/ho-gia-dinh/' + id + '/thanh-vien', {
                    ...memberPayload,
                    ho_gia_dinh_id: Number(id)
                }, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (memberResponse.data?.data?.id) {
                    createdMemberIds[memberIndex] = memberResponse.data.data.id;
                    member.id = memberResponse.data.data.id;
                }
            }
        }

        for (const service of serviceLines) {
            const soThueBao = (service.so_thue_bao || '').trim();
            if (!soThueBao) continue;
            const selectedMemberRef = service.thanh_vien_ref ?? service.thanh_vien_id;
            const isHouseholdOwner = ownerMode === 'chu_ho' || selectedMemberRef === '__chu_ho__';
            const mappedMemberId = resolveThanhVienId(selectedMemberRef, normalizedMembers, createdMemberIds);
            const selectedMember = resolveMemberFromRef(selectedMemberRef, normalizedMembers, createdMemberIds);
            const servicePayload = stripEmptyFields({
                ...service,
                ho_gia_dinh_id: Number(id),
                thanh_vien_id: mappedMemberId,
                loai_dich_vu_id: service.loai_dich_vu_id || null,
                so_thue_bao: soThueBao,
                ten_chu_thue_bao: isHouseholdOwner ? (householdPayload.ten_chu_ho || service.ten_chu_thue_bao || '') : (service.ten_chu_thue_bao || selectedMember?.ho_ten || ''),
                cmnd_chu_thue_bao: isHouseholdOwner ? (householdPayload.so_cmnd || service.cmnd_chu_thue_bao || '') : (service.cmnd_chu_thue_bao || selectedMember?.so_cmnd || ''),
                ngay_dang_ky: service.ngay_dang_ky || null,
                ngay_kich_hoat: service.ngay_kich_hoat || null,
                ngay_het_han: service.ngay_het_han || null,
                trang_thai_dich_vu: service.trang_thai_dich_vu || 'cho_kich_hoat'
            });

            if (service.id) {
                await axios.put('http://localhost:3000/api/thue-bao/' + service.id, servicePayload, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
            } else {
                await axios.post('http://localhost:3000/api/ho-gia-dinh/' + id + '/thue-bao', servicePayload, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
            }
        }

        res.redirect('/ho-gia-dinh/' + id + '/edit?updated=1');
    } catch (error) {
        let hoData = req.body;
        let xaList = [];
        let vnptKhuVucList = [];
        let loaiList = [];
        let loaiDichVuList = [];

        try {
            const token = req.session.token;
            const { id } = req.params;
            const [hoRes, xaRes, vnptRes, loaiRes, loaiDichVuRes] = await Promise.all([
                axios.get('http://localhost:3000/api/ho-gia-dinh/' + id, { headers: { 'Authorization': 'Bearer ' + token } }),
                axios.get('http://localhost:3000/api/danh-muc/xa', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } }),
                axios.get('http://localhost:3000/api/danh-muc/vnpt-khu-vuc', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } }),
                axios.get('http://localhost:3000/api/danh-muc/loai-doi-tuong', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } }),
                axios.get('http://localhost:3000/api/danh-muc/loai-dich-vu', { params: { page: 1, limit: 1000 }, headers: { 'Authorization': 'Bearer ' + token } })
            ]);
            hoData = { ...(hoRes.data.data || {}), ...req.body };
            xaList = xaRes.data.data || [];
            vnptKhuVucList = vnptRes.data.data || [];
            loaiList = loaiRes.data.data || [];
            loaiDichVuList = loaiDichVuRes.data.data || [];
        } catch (loadError) {
            hoData = req.body;
        }

        res.render('pages/ho-gia-dinh/edit', {
            title: 'Sua ho gia dinh',
            user: req.session.user,
            token: req.session.token || '',
            ho: hoData,
            xaList,
            vnptKhuVucList: Array.isArray(vnptKhuVucList) ? vnptKhuVucList : [],
            loaiList,
            loaiDichVuList,
            error: error.response?.data?.message || 'Loi cap nhat',
            successMessage: null
        });
    }
});

router.post('/ho-gia-dinh/:id/delete', requireLogin, requireRole('admin', 'manager', 'vnpt_khu_vuc'), async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.session.token;
        const response = await axios.delete('http://localhost:3000/api/ho-gia-dinh/' + id, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        res.json({ success: true, message: response.data?.message || 'Xoa thanh cong' });
    } catch (error) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.message || error.message || 'Khong the xoa ho gia dinh';
        res.status(status).json({ success: false, message });
    }
});

// ====== IMPORT ======
router.get('/import', requireLogin, requireRole('admin', 'manager', 'vnpt_khu_vuc'), (req, res) => {
    res.render('pages/import', {
        title: 'Import du lieu',
        user: req.session.user,
        message: null,
        error: null
    });
});

router.get('/users', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
        const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 20;
        const token = req.session.token;
        const response = await axios.get('http://localhost:3000/api/auth/users', {
            params: { page, limit },
            headers: { 'Authorization': 'Bearer ' + token }
        });

        res.render('pages/users', {
            title: 'Quan ly nguoi dung',
            user: req.session.user,
            data: response.data.data || [],
            pagination: response.data.pagination || { page, limit, total: 0, totalPages: 1 }
        });
    } catch (error) {
        res.render('pages/users', {
            title: 'Quan ly nguoi dung',
            user: req.session.user,
            data: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 1 }
        });
    }
});

// ====== DUYET HO SO ======
router.get('/duyet-ho-so', requireLogin, requireRole('admin', 'vnpt_khu_vuc'), async (req, res) => {
    const search = normalizeText(req.query.search);
    const xaId = /^\d+$/.test(String(req.query.xa_id || '')) ? String(req.query.xa_id) : '';
    const statusOptions = [
        { value: 'day_du', label: 'Đã duyệt' },
        { value: 'chua_co', label: 'Chưa có' },
        { value: 'thieu', label: 'Thiếu hồ sơ' },
        { value: 'cho_duyet', label: 'Chờ duyệt' },
        { value: 'tu_choi', label: 'Từ chối' }
    ];
    const allowedStatuses = new Set(statusOptions.map(option => option.value));
    const trangThaiHoSo = allowedStatuses.has(String(req.query.trang_thai_ho_so || ''))
        ? String(req.query.trang_thai_ho_so)
        : '';

    try {
        const page = Number.isSafeInteger(Number(req.query.page)) && Number(req.query.page) > 0 ? Number(req.query.page) : 1;
        const limit = getPageSize(req.query.limit);
        const offset = (page - 1) * limit;
        const isVnptUser = hasRole(req.session.user, 'vnpt_khu_vuc');
        const [xaRows] = await pool.query(
            'SELECT id, ten_xa FROM danh_muc_xa WHERE trang_thai IS NULL OR trang_thai <> ? ORDER BY ten_xa',
            ['ngung_hoat_dong']
        );

        let sql = `
            SELECT h.*, ${householdDocumentStatus('h')} AS trang_thai_ho_so, x.ten_xa
            FROM ho_gia_dinh h
            LEFT JOIN danh_muc_xa x ON h.xa_id = x.id
            WHERE 1=1
        `;
        let countSql = `
            SELECT COUNT(*) as total
            FROM ho_gia_dinh h
            LEFT JOIN danh_muc_xa x ON h.xa_id = x.id
            WHERE 1=1
        `;
        const params = [];
        const countParams = [];

        if (search) {
            sql += ' AND (h.ma_ho ILIKE ? OR h.ten_chu_ho ILIKE ? OR h.so_cmnd ILIKE ?)';
            countSql += ' AND (h.ma_ho ILIKE ? OR h.ten_chu_ho ILIKE ? OR h.so_cmnd ILIKE ?)';
            const searchPattern = '%' + search + '%';
            params.push(searchPattern, searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern, searchPattern);
        }

        if (xaId) {
            sql += ' AND h.xa_id = ?';
            countSql += ' AND h.xa_id = ?';
            params.push(xaId);
            countParams.push(xaId);
        }

        if (trangThaiHoSo) {
            sql += ` AND ${householdDocumentStatus('h')} = ?`;
            countSql += ` AND ${householdDocumentStatus('h')} = ?`;
            params.push(trangThaiHoSo);
            countParams.push(trangThaiHoSo);
        } else {
            sql += ` AND ${householdDocumentStatus('h')} <> ?`;
            countSql += ` AND ${householdDocumentStatus('h')} <> ?`;
            params.push('day_du');
            countParams.push('day_du');
        }

        if (isVnptUser) {
            const areaId = Number(req.session.user.vnpt_khu_vuc_id);
            if (areaId) {
                sql += ' AND h.vnpt_khu_vuc_id = ?';
                countSql += ' AND h.vnpt_khu_vuc_id = ?';
                params.push(areaId);
                countParams.push(areaId);
            }
        }

        const [countResult] = await pool.query(countSql, countParams);
        const total = Number(countResult[0]?.total || 0);

        sql += ' ORDER BY h.updated_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [rows] = await pool.query(sql, params);

        const householdIds = rows.map(row => row.id);
        let documents = [];
        if (householdIds.length) {
            const placeholders = householdIds.map(() => '?').join(',');
            const [docRows] = await pool.query(`
                SELECT * FROM ho_so_dinh_kem
                WHERE ho_gia_dinh_id IN (${placeholders})
                ORDER BY created_at DESC
            `, householdIds);
            documents = docRows || [];
        }

        const documentsByHousehold = new Map();
        documents.forEach(item => {
            const key = Number(item.ho_gia_dinh_id);
            if (!documentsByHousehold.has(key)) documentsByHousehold.set(key, []);
            documentsByHousehold.get(key).push(item);
        });

        const data = rows.map(ho => ({
            ...ho,
            ho_so: documentsByHousehold.get(Number(ho.id)) || []
        }));

        res.render('pages/duyet-ho-so', {
            title: 'Duyet ho so',
            user: req.session.user,
            data,
            xaList: xaRows || [],
            search,
            xaId,
            trangThaiHoSo,
            statusOptions,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        res.render('pages/duyet-ho-so', {
            title: 'Duyet ho so',
            user: req.session.user,
            data: [],
            xaList: [],
            search,
            xaId,
            trangThaiHoSo,
            statusOptions,
            pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
            message: null,
            error: 'Loi ket noi du lieu'
        });
    }
});

router.post('/duyet-ho-so/approve', requireLogin, requireRole('admin', 'vnpt_khu_vuc'), async (req, res) => {
    try {
        const selected = Array.isArray(req.body.selectedIds)
            ? req.body.selectedIds
            : (req.body.selectedIds ? String(req.body.selectedIds).split(',') : []);

        const normalized = [...new Set(selected.map(item => Number(item)).filter(item => Number.isInteger(item) && item > 0))];
        if (!normalized.length) {
            return res.redirect('/duyet-ho-so?error=Vui%20long%20chon%20it%20nhat%20m%E1%BB%99t%20h%E1%BB%99%20gia%20%C4%91%C3%ACnh');
        }

        const userRole = normalizeRole(req.session.user?.vai_tro || req.session.user?.role);
        const userAreaId = Number(req.session.user?.vnpt_khu_vuc_id);
        let allowedIds = normalized;

        if (userRole === 'vnptkhuvuc') {
            if (!userAreaId) {
                return res.redirect('/duyet-ho-so?error=Tai%20khoan%20VNPT%20khu%20vuc%20chua%20co%20khu%20vuc');
            }

            const placeholders = normalized.map(() => '?').join(',');
            const [rows] = await pool.query(`
                SELECT id
                FROM ho_gia_dinh
                WHERE id IN (${placeholders}) AND vnpt_khu_vuc_id = ?
            `, [...normalized, userAreaId]);
            allowedIds = (rows || []).map(row => Number(row.id));

            if (allowedIds.length !== normalized.length) {
                return res.redirect('/duyet-ho-so?error=Ban%20chi%20duoc%20duyet%20ho%20so%20thuoc%20khu%20vuc%20cua%20minh');
            }
        }

        const affected = await reviewDocuments(allowedIds, 'day_du');
        if (!affected) return res.redirect('/duyet-ho-so?error=' + encodeURIComponent('Chỉ duyệt được hồ sơ đã đủ giấy tờ và đang chờ duyệt'));
        const message = affected < allowedIds.length ? 'Đã duyệt các hồ sơ đủ điều kiện; các hồ sơ khác không được duyệt' : 'Duyệt hồ sơ thành công';
        res.redirect('/duyet-ho-so?message=' + encodeURIComponent(message));
    } catch (error) {
        res.redirect('/duyet-ho-so?error=' + encodeURIComponent(error.message || 'Loi duyet ho so'));
    }
});

router.post('/duyet-ho-so/reject', requireLogin, requireRole('admin', 'vnpt_khu_vuc'), async (req, res) => {
    try {
        const selected = Array.isArray(req.body.selectedIds)
            ? req.body.selectedIds
            : (req.body.selectedIds ? String(req.body.selectedIds).split(',') : []);

        const normalized = [...new Set(selected.map(item => Number(item)).filter(item => Number.isInteger(item) && item > 0))];
        if (!normalized.length) {
            return res.redirect('/duyet-ho-so?error=Vui%20long%20chon%20it%20nhat%20m%E1%BB%99t%20h%E1%BB%99%20gia%20%C4%91%C3%ACnh');
        }

        const reason = String(req.body.ly_do_tu_choi || '').trim();
        if (!reason) {
            return res.redirect('/duyet-ho-so?error=Vui%20long%20nhap%20ly%20do%20tu%20choi%20ho%20so');
        }

        const userRole = normalizeRole(req.session.user?.vai_tro || req.session.user?.role);
        const userAreaId = Number(req.session.user?.vnpt_khu_vuc_id);
        let allowedIds = normalized;

        if (userRole === 'vnptkhuvuc') {
            if (!userAreaId) {
                return res.redirect('/duyet-ho-so?error=Tai%20khoan%20VNPT%20khu%20vuc%20chua%20co%20khu%20vuc');
            }

            const placeholders = normalized.map(() => '?').join(',');
            const [rows] = await pool.query(`
                SELECT id
                FROM ho_gia_dinh
                WHERE id IN (${placeholders}) AND vnpt_khu_vuc_id = ?
            `, [...normalized, userAreaId]);
            allowedIds = (rows || []).map(row => Number(row.id));

            if (allowedIds.length !== normalized.length) {
                return res.redirect('/duyet-ho-so?error=Ban%20chi%20duoc%20tu%20choi%20ho%20so%20thuoc%20khu%20vuc%20cua%20minh');
            }
        }

        const affected = await reviewDocuments(allowedIds, 'tu_choi', reason);
        if (!affected) return res.redirect('/duyet-ho-so?error=' + encodeURIComponent('Chỉ từ chối được hồ sơ đã đủ giấy tờ và đang chờ duyệt'));
        const message = affected < allowedIds.length ? 'Đã từ chối các hồ sơ đủ điều kiện; các hồ sơ khác không được xử lý' : 'Từ chối hồ sơ thành công';
        res.redirect('/duyet-ho-so?message=' + encodeURIComponent(message));
    } catch (error) {
        res.redirect('/duyet-ho-so?error=' + encodeURIComponent(error.message || 'Loi tu choi ho so'));
    }
});

// ====== BAO CAO ======
router.get('/bao-cao', requireLogin, async (req, res) => {
    try {
        const token = req.session.token;
        const year = Number(req.query.year) > 0 ? Number(req.query.year) : new Date().getFullYear();
        const month = Number(req.query.month) > 0 ? Number(req.query.month) : '';

        const [dashboardRes, thueBaoMoiRes, hoSoThieuRes] = await Promise.all([
            axios.get('http://localhost:3000/api/thong-ke/dashboard', {
                headers: { 'Authorization': 'Bearer ' + token }
            }),
            axios.get('http://localhost:3000/api/thong-ke/thue-bao-moi', {
                params: { year, month },
                headers: { 'Authorization': 'Bearer ' + token }
            }),
            axios.get('http://localhost:3000/api/thong-ke/ho-so-thieu-khu-vuc', {
                params: { year },
                headers: { 'Authorization': 'Bearer ' + token }
            })
        ]);

        res.render('pages/bao-cao', {
            title: 'Bao cao thong ke',
            user: req.session.user,
            data: dashboardRes.data.data || {},
            thueBaoMoi: thueBaoMoiRes.data.data || { rows: [], total: 0 },
            hoSoThieu: hoSoThieuRes.data.data || { rows: [], summary: [], total: 0 },
            filterYear: year,
            filterMonth: month
        });
    } catch (error) {
        res.render('pages/bao-cao', {
            title: 'Bao cao thong ke',
            user: req.session.user,
            data: {},
            thueBaoMoi: { rows: [], total: 0 },
            hoSoThieu: { rows: [], summary: [], total: 0 },
            filterYear: new Date().getFullYear(),
            filterMonth: ''
        });
    }
});

// ====== DANH MUC ======
router.get('/danh-muc', requireLogin, requireRole('admin', 'manager'), (req, res) => {
    res.render('pages/danh-muc/index', {
        title: 'Danh muc he thong',
        user: req.session.user
    });
});

router.get('/danh-muc/xa', requireLogin, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const token = req.session.token;
        const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
        const response = await axios.get('http://localhost:3000/api/danh-muc/xa', {
            params: { page, limit: 20 },
            headers: { 'Authorization': 'Bearer ' + token }
        });
        res.render('pages/danh-muc/xa', {
            title: 'Quan ly xa',
            user: req.session.user,
            data: response.data.data || [],
            pagination: response.data.pagination || {},
            page
        });
    } catch (error) {
        res.render('pages/danh-muc/xa', {
            title: 'Quan ly xa',
            user: req.session.user,
            data: [],
            pagination: {},
            page: 1
        });
    }
});

router.get('/danh-muc/loai-doi-tuong', requireLogin, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const token = req.session.token;
        const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
        const response = await axios.get('http://localhost:3000/api/danh-muc/loai-doi-tuong', {
            params: { page, limit: 20 },
            headers: { 'Authorization': 'Bearer ' + token }
        });
        res.render('pages/danh-muc/loai-doi-tuong', {
            title: 'Quan ly loai doi tuong',
            user: req.session.user,
            data: response.data.data || [],
            pagination: response.data.pagination || {},
            page
        });
    } catch (error) {
        res.render('pages/danh-muc/loai-doi-tuong', {
            title: 'Quan ly loai doi tuong',
            user: req.session.user,
            data: [],
            pagination: {},
            page: 1
        });
    }
});

router.get('/danh-muc/loai-dich-vu', requireLogin, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const token = req.session.token;
        const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
        const response = await axios.get('http://localhost:3000/api/danh-muc/loai-dich-vu', {
            params: { page, limit: 20 },
            headers: { 'Authorization': 'Bearer ' + token }
        });
        res.render('pages/danh-muc/loai-dich-vu', {
            title: 'Quan ly loai dich vu',
            user: req.session.user,
            data: response.data.data || [],
            pagination: response.data.pagination || {},
            page
        });
    } catch (error) {
        res.render('pages/danh-muc/loai-dich-vu', {
            title: 'Quan ly loai dich vu',
            user: req.session.user,
            data: [],
            pagination: {},
            page: 1
        });
    }
});

router.get('/danh-muc/vnpt-khu-vuc', requireLogin, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const token = req.session.token;
        const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
        const response = await axios.get('http://localhost:3000/api/danh-muc/vnpt-khu-vuc', {
            params: { page, limit: 20 },
            headers: { 'Authorization': 'Bearer ' + token }
        });
        res.render('pages/danh-muc/vnpt-khu-vuc', {
            title: 'Quan ly VNPT khu vuc',
            user: req.session.user,
            data: response.data.data || [],
            pagination: response.data.pagination || {},
            page
        });
    } catch (error) {
        res.render('pages/danh-muc/vnpt-khu-vuc', {
            title: 'Quan ly VNPT khu vuc',
            user: req.session.user,
            data: [],
            pagination: {},
            page: 1
        });
    }
});

module.exports = router;