const ANNUAL_DOCUMENT_TYPES = [
    'giay_chung_nhan_ho_ngheo_can_ngheo',
    'don_dang_ky_su_dung',
    'hop_dong_cung_cap_dv',
    'giay_cam_ket'
];
const IDENTITY_DOCUMENT_TYPE = 'giay_cccd';
const REQUIRED_DOCUMENT_TYPES = [...ANNUAL_DOCUMENT_TYPES, IDENTITY_DOCUMENT_TYPE];

function missingDocumentAggregate(type, yearExpression, documentAlias = 'hs') {
    const yearCondition = type === IDENTITY_DOCUMENT_TYPE
        ? ''
        : ` AND COALESCE(${documentAlias}.nam_ho_so, EXTRACT(YEAR FROM ${documentAlias}.created_at)) = ${yearExpression}`;
    return `SUM(CASE WHEN ${documentAlias}.loai_ho_so = '${type}'${yearCondition} THEN 1 ELSE 0 END) = 0`;
}

function householdDocumentStatus(householdAlias = 'h') {
    const currentYear = 'EXTRACT(YEAR FROM CURRENT_DATE)';
    const relevant = `(d.loai_ho_so = '${IDENTITY_DOCUMENT_TYPE}' OR (d.loai_ho_so IN (${ANNUAL_DOCUMENT_TYPES.map(type => `'${type}'`).join(', ')}) AND COALESCE(d.nam_ho_so, EXTRACT(YEAR FROM d.created_at)) = ${currentYear}))`;
    const missing = REQUIRED_DOCUMENT_TYPES.map(type => {
        const yearCondition = type === IDENTITY_DOCUMENT_TYPE ? '' : ` AND COALESCE(d.nam_ho_so, EXTRACT(YEAR FROM d.created_at)) = ${currentYear}`;
        return `NOT EXISTS (SELECT 1 FROM ho_so_dinh_kem d WHERE d.ho_gia_dinh_id = ${householdAlias}.id AND d.loai_ho_so = '${type}'${yearCondition})`;
    }).join(' OR ');
    return `(CASE
        WHEN NOT EXISTS (SELECT 1 FROM ho_so_dinh_kem d WHERE d.ho_gia_dinh_id = ${householdAlias}.id AND ${relevant}) THEN 'chua_co'
        WHEN ${missing} THEN 'thieu'
        WHEN ${householdAlias}.trang_thai_ho_so IN ('day_du', 'tu_choi') AND COALESCE(${householdAlias}.nam_xet_duyet, EXTRACT(YEAR FROM ${householdAlias}.updated_at)) = ${currentYear} THEN ${householdAlias}.trang_thai_ho_so
        ELSE 'cho_duyet'
    END)`;
}

async function invalidateReview(connection, householdId, documents) {
    const relevant = documents.map(() => "(? = 'giay_cccd' OR ? = EXTRACT(YEAR FROM CURRENT_DATE))").join(' OR ');
    const params = documents.flatMap(document => [document.loai_ho_so, document.nam_ho_so]);
    await connection.query(`UPDATE ho_gia_dinh SET trang_thai_ho_so = 'can_bo_sung', nam_xet_duyet = NULL, ly_do_tu_choi = NULL WHERE id = ? AND trang_thai_ho_so IN ('day_du', 'tu_choi') AND (${relevant})`, [householdId, ...params]);
}

module.exports = { ANNUAL_DOCUMENT_TYPES, IDENTITY_DOCUMENT_TYPE, REQUIRED_DOCUMENT_TYPES, missingDocumentAggregate, householdDocumentStatus, invalidateReview };