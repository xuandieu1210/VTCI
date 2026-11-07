const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const express = require('express');
require('dotenv').config();
const pool = require('../src/config/database');
const { ANNUAL_DOCUMENT_TYPES, householdDocumentStatus, missingDocumentAggregate, invalidateReview } = require('../src/utils/documentStatus');

test('document completeness uses annual papers and a reusable identity document', async () => {
    const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 5432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
    const originalQuery = pool.query;
    const originalGetConnection = pool.getConnection;
    let server;
    await client.connect();
    try {
        await client.query('BEGIN');
        await client.query('CREATE TEMP TABLE households (id int, trang_thai_ho_so text, nam_xet_duyet int, updated_at timestamp) ON COMMIT DROP');
        await client.query('CREATE TEMP TABLE ho_so_dinh_kem (ho_gia_dinh_id int, loai_ho_so text, nam_ho_so int, created_at timestamp DEFAULT CURRENT_TIMESTAMP) ON COMMIT DROP');
        const year = Number((await client.query('SELECT EXTRACT(YEAR FROM CURRENT_DATE) AS year')).rows[0].year);
        await client.query("INSERT INTO households VALUES (1, 'chua_co', NULL, CURRENT_TIMESTAMP), (2, 'chua_co', NULL, CURRENT_TIMESTAMP), (3, 'chua_co', NULL, CURRENT_TIMESTAMP), (4, 'day_du', $1, CURRENT_TIMESTAMP), (5, 'day_du', $2, CURRENT_TIMESTAMP), (6, 'tu_choi', $1, CURRENT_TIMESTAMP), (7, 'chua_co', NULL, CURRENT_TIMESTAMP)", [year, year - 1]);
        await client.query("INSERT INTO ho_so_dinh_kem (ho_gia_dinh_id, loai_ho_so, nam_ho_so) VALUES (2, 'giay_cccd', $1), (3, 'giay_cccd', $1), (4, 'giay_cccd', $1), (5, 'giay_cccd', $1), (6, 'giay_cccd', $1)", [year - 1]);
        for (const id of [3, 4, 5, 6, 7]) {
            for (const type of ANNUAL_DOCUMENT_TYPES) {
                await client.query('INSERT INTO ho_so_dinh_kem (ho_gia_dinh_id, loai_ho_so, nam_ho_so) VALUES ($1, $2, $3)', [id, type, year]);
            }
        }
        await client.query('UPDATE ho_so_dinh_kem SET nam_ho_so = $1 WHERE ho_gia_dinh_id = 3 AND loai_ho_so = $2', [year - 1, ANNUAL_DOCUMENT_TYPES[0]]);
        const result = await client.query(`SELECT h.id, ${householdDocumentStatus('h')} AS status FROM households h ORDER BY h.id`);
        assert.deepEqual(result.rows.map(row => row.status), ['chua_co', 'thieu', 'thieu', 'day_du', 'cho_duyet', 'tu_choi', 'thieu']);
        const aggregate = await client.query(`SELECT ${missingDocumentAggregate('giay_cccd', '$1')} AS missing FROM ho_so_dinh_kem hs WHERE ho_gia_dinh_id = 4`);
        assert.equal(aggregate.rows[0].missing, false);
        await client.query('CREATE TEMP TABLE ho_gia_dinh (id int PRIMARY KEY, trang_thai_ho_so text, nam_xet_duyet int, ly_do_tu_choi text, updated_at timestamp) ON COMMIT DROP');
        await client.query("INSERT INTO ho_gia_dinh VALUES (4, 'day_du', $1, NULL, CURRENT_TIMESTAMP), (6, 'tu_choi', $1, 'reason', CURRENT_TIMESTAMP)", [year]);
        const connection = { query: (sql, params) => {
            let index = 0;
            return client.query(sql.replace(/\?/g, () => `$${++index}`), params);
        } };
        await invalidateReview(connection, 4, [{ loai_ho_so: ANNUAL_DOCUMENT_TYPES[0], nam_ho_so: year - 1 }]);
        let statuses = await client.query('SELECT trang_thai_ho_so FROM ho_gia_dinh WHERE id = 4');
        assert.equal(statuses.rows[0].trang_thai_ho_so, 'day_du');
        await invalidateReview(connection, 4, [{ loai_ho_so: ANNUAL_DOCUMENT_TYPES[0], nam_ho_so: year }]);
        await invalidateReview(connection, 6, [{ loai_ho_so: 'giay_cccd', nam_ho_so: year - 1 }]);
        statuses = await client.query(`SELECT h.id, ${householdDocumentStatus('h')} AS status, h.ly_do_tu_choi FROM ho_gia_dinh h ORDER BY h.id`);
        assert.deepEqual(statuses.rows.map(row => row.status), ['cho_duyet', 'cho_duyet']);
        assert.equal(statuses.rows[1].ly_do_tu_choi, null);
        await client.query('ALTER TABLE ho_gia_dinh ADD COLUMN ma_ho text, ADD COLUMN ten_chu_ho text, ADD COLUMN so_cmnd text, ADD COLUMN xa_id int, ADD COLUMN vnpt_khu_vuc_id int');
        await client.query("INSERT INTO ho_gia_dinh (id, trang_thai_ho_so, updated_at, ma_ho) VALUES (3, 'chua_co', CURRENT_TIMESTAMP, 'test')");
        await client.query('CREATE TEMP TABLE danh_muc_xa (id int PRIMARY KEY, ma_xa text, ten_xa text) ON COMMIT DROP');
        await client.query('CREATE TEMP TABLE vnpt_khu_vuc (id int PRIMARY KEY, ma_khu_vuc text, ten_khu_vuc text) ON COMMIT DROP');
        const transactionalQuery = async (sql, params = []) => {
            let index = 0;
            let text = sql.replace(/\?/g, () => `$${++index}`);
            const insert = /^\s*INSERT\s+INTO/i.test(text);
            if (insert) text += ' RETURNING id';
            const result = await client.query(text, params);
            if (insert) return [{ insertId: result.rows[0].id, affectedRows: result.rowCount }];
            if (result.command === 'UPDATE' || result.command === 'DELETE') return [{ affectedRows: result.rowCount }];
            return [result.rows];
        };
        pool.query = transactionalQuery;
        pool.getConnection = async () => ({
            query: transactionalQuery,
            beginTransaction: () => client.query('SAVEPOINT document_request'),
            commit: () => client.query('RELEASE SAVEPOINT document_request'),
            rollback: () => client.query('ROLLBACK TO SAVEPOINT document_request'),
            release: () => {}
        });
        let report;
        let reportStatus = 200;
        await require('../src/controllers/thongKeController').baoCaoHoSoThieuTheoKhuVuc({ query: { year } }, {
            status(code) { reportStatus = code; return this; },
            json(value) { report = value; }
        });
        assert.equal(reportStatus, 200, report?.message);
        assert.equal(report.data.total, 1);
        assert.match(report.data.rows[0].ds_loai_ho_so_thieu, /giay_chung_nhan_ho_ngheo_can_ngheo/);
        assert.doesNotMatch(report.data.rows[0].ds_loai_ho_so_thieu, /giay_cccd/);

        const wrapper = express();
        wrapper.use((req, res, next) => {
            req.session = { user: { id: 1, vai_tro: 'admin' } };
            next();
        });
        wrapper.use(require('../src/app'));
        server = await new Promise(resolve => {
            const listener = wrapper.listen(0, '127.0.0.1', () => resolve(listener));
        });
        const baseUrl = `http://127.0.0.1:${server.address().port}/duyet-ho-so/`;
        const post = (action, values) => fetch(baseUrl + action, {
            method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values)
        });
        let response = await post('approve', { selectedIds: '3' });
        assert.match(response.headers.get('location'), /error=/);
        response = await post('approve', { selectedIds: '4' });
        assert.match(response.headers.get('location'), /message=/);
        response = await post('reject', { selectedIds: '6', ly_do_tu_choi: 'reason' });
        assert.match(response.headers.get('location'), /message=/);
        statuses = await client.query(`SELECT h.id, ${householdDocumentStatus('h')} AS status FROM ho_gia_dinh h ORDER BY h.id`);
        assert.deepEqual(statuses.rows.map(row => row.status), ['thieu', 'day_du', 'tu_choi']);

        await client.query('ALTER TABLE ho_so_dinh_kem ADD COLUMN id SERIAL PRIMARY KEY, ADD COLUMN thanh_vien_id int, ADD COLUMN ten_file text, ADD COLUMN duong_dan_file text, ADD COLUMN dung_luong bigint, ADD COLUMN dinh_dang text, ADD COLUMN ngay_het_han date, ADD COLUMN trang_thai text, ADD COLUMN nguoi_tai_len text, ADD COLUMN mo_ta text');
        const controller = require('../src/controllers/hoSoController');
        let body;
        let status = 200;
        const mockResponse = { status(code) { status = code; return this; }, json(value) { body = value; } };
        await controller.upload({ body: { ho_gia_dinh_id: 4, loai_ho_so: 'giay_cam_ket', nam_ho_so: year }, file: { filename: `test-${randomUUID()}.pdf`, originalname: 'test.pdf', size: 10 }, user: { username: 'test' } }, mockResponse);
        assert.equal(status, 201, body?.message);
        const documentId = body.data.id;
        statuses = await client.query(`SELECT ${householdDocumentStatus('h')} AS status FROM ho_gia_dinh h WHERE id = 4`);
        assert.equal(statuses.rows[0].status, 'cho_duyet');
        status = 200;
        await controller.delete({ params: { id: documentId } }, mockResponse);
        assert.equal(status, 200, body?.message);
        statuses = await client.query(`SELECT ${householdDocumentStatus('h')} AS status FROM ho_gia_dinh h WHERE id = 4`);
        assert.equal(statuses.rows[0].status, 'thieu');
        const identity = await client.query("SELECT id FROM ho_so_dinh_kem WHERE ho_gia_dinh_id = 6 AND loai_ho_so = 'giay_cccd'");
        status = 200;
        await controller.update({ params: { id: identity.rows[0].id }, body: { loai_ho_so: 'giay_cccd', nam_ho_so: year - 1, ngay_het_han: null, trang_thai: 'con_hieu_luc', mo_ta: 'updated' } }, mockResponse);
        assert.equal(status, 200, body?.message);
        statuses = await client.query(`SELECT ${householdDocumentStatus('h')} AS status FROM ho_gia_dinh h WHERE id = 6`);
        assert.equal(statuses.rows[0].status, 'cho_duyet');
    } finally {
        pool.query = originalQuery;
        pool.getConnection = originalGetConnection;
        if (server) await new Promise(resolve => server.close(resolve));
        await pool.end();
        await client.query('ROLLBACK');
        await client.end();
    }
});