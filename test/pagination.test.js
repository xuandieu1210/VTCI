const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const axios = require('axios');
const pool = require('../src/config/database');
const app = require('../src/app');

test('household and approval page sizes preserve filters and pagination', async () => {
    const originalQuery = pool.query;
    const originalGet = axios.get;
    const requests = [];
    let server;
    const makeRows = (limit, offset) => Array.from({ length: Math.max(0, Math.min(limit, 65 - offset)) }, (_, index) => ({
        id: offset + index + 1, ma_ho: `TEST_${offset + index + 1}`, ten_chu_ho: 'Test', so_cmnd: '123',
        trang_thai_ho_so: 'chua_co', thue_bao: []
    }));
    try {
        axios.get = async url => {
            if (url.includes('/api/danh-muc/xa')) return { data: { data: [{ id: 1, ten_xa: 'Test' }] } };
            if (url.includes('/api/danh-muc/vnpt-khu-vuc')) return { data: { data: [{ id: 1, ten_khu_vuc: 'Test' }] } };
            const params = new URL(url).searchParams;
            requests.push(params);
            const limit = Number(params.get('limit'));
            const page = Number(params.get('page'));
            return { data: { data: makeRows(limit, (page - 1) * limit), pagination: { page, limit, total: 65, totalPages: Math.ceil(65 / limit) } } };
        };
        pool.query = async (sql, params = []) => {
            if (/FROM ho_so_dinh_kem\s+WHERE ho_gia_dinh_id IN/i.test(sql)) return [[]];
            if (/SELECT\s+h\.\*/i.test(sql)) {
                const limit = Number(params[params.length - 2]);
                const offset = Number(params[params.length - 1]);
                return [makeRows(limit, offset)];
            }
            if (/COUNT\(\*\)/i.test(sql)) return [[{ total: 65 }]];
            if (/FROM danh_muc_xa/i.test(sql)) return [[{ id: 1, ten_xa: 'Test' }]];
            return [[]];
        };
        const wrapper = express();
        wrapper.use((req, res, next) => {
            req.session = { user: { id: 1, vai_tro: 'admin' }, token: 'test' };
            next();
        });
        wrapper.use(app);
        server = await new Promise(resolve => {
            const listener = wrapper.listen(0, '127.0.0.1', () => resolve(listener));
        });
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        for (const route of ['/ho-gia-dinh', '/ho-gia-dinh?thieu_ho_so=1', '/duyet-ho-so']) {
            const separator = route.includes('?') ? '&' : '?';
            const response = await fetch(`${baseUrl}${route}${separator}page=2&limit=50&search=TEST&xa_id=1`);
            assert.equal(response.status, 200);
            const html = await response.text();
            const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
            assert.equal((body.match(/<tr(?:\s|>)/g) || []).length, 15, route);
            assert.match(html, /<option value="50" selected>/);
            const links = [...html.matchAll(/href="([^"]*)"/g)].map(match => match[1].replace(/&amp;/g, '&'));
            assert.ok(links.some(link => link.includes('page=1&limit=50&search=TEST&xa_id=1')));
            assert.match(html, /name="limit" form="(?:household|approval)Filters"/);
        }
        assert.equal(requests[0].get('limit'), '50');
        assert.equal(requests[0].get('search'), 'TEST');
        for (const route of ['/ho-gia-dinh', '/ho-gia-dinh?thieu_ho_so=1', '/duyet-ho-so']) {
            for (const limit of [10, 20, 100]) {
                const separator = route.includes('?') ? '&' : '?';
                const response = await fetch(`${baseUrl}${route}${separator}limit=${limit}`);
                const html = await response.text();
                const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
                assert.equal((body.match(/<tr(?:\s|>)/g) || []).length, Math.min(limit, 65), `${route}: ${limit}`);
                assert.match(html, new RegExp(`<option value="${limit}" selected>`));
            }
        }
        for (const route of ['/ho-gia-dinh', '/duyet-ho-so']) {
            const response = await fetch(`${baseUrl}${route}?limit=999999&page=2.5`);
            const html = await response.text();
            const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
            assert.equal((body.match(/<tr(?:\s|>)/g) || []).length, 20, route);
            assert.match(html, /<option value="20" selected>/);
        }
    } finally {
        axios.get = originalGet;
        pool.query = originalQuery;
        if (server) await new Promise(resolve => server.close(resolve));
        await pool.end();
    }
});