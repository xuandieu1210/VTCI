const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const pool = require('../src/config/database');

test('authenticated document previews support uploaded formats and report errors', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hoso-preview-'));
    const originalQuery = pool.query;
    const originalConvert = mammoth.convertToHtml;
    let server;
    try {
        const files = {
            1: path.join(directory, 'document.pdf'),
            2: path.join(directory, 'image.png'),
            3: path.join(directory, 'document.docx'),
            4: path.join(directory, 'workbook.xlsx'),
            5: path.join(directory, 'data.csv'),
            6: path.join(directory, 'missing.pdf'),
            7: path.join(directory, 'unknown.zip'),
            8: path.join(directory, 'image.jpg'),
            9: path.join(directory, 'image.jpeg')
        };
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
        const jpeg = Buffer.from([255, 216, 255, 217]);
        fs.writeFileSync(files[1], '%PDF-1.4 test');
        fs.writeFileSync(files[2], png);
        fs.writeFileSync(files[8], jpeg);
        fs.writeFileSync(files[9], jpeg);
        fs.writeFileSync(files[3], 'test');
        fs.writeFileSync(files[5], 'name,value\nExample,123');
        fs.writeFileSync(files[7], 'test');
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Name', 'Value'], ['Example', 123]]), 'Sheet1');
        XLSX.writeFile(workbook, files[4]);
        pool.query = async (sql, params) => [files[params[0]] ? [{ duong_dan_file: files[params[0]] }] : []];
        mammoth.convertToHtml = async () => ({ value: '<p>Example document</p><script>alert(1)</script><img src="https://example.com/image.png">' });

        const app = express();
        app.use((req, res, next) => {
            if (req.headers['x-test-auth']) req.session = { user: { id: 1, vai_tro: 'admin' } };
            next();
        });
        app.use('/api/ho-so', require('../src/routes/hoSoRoutes'));
        server = await new Promise(resolve => {
            const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
        });
        const baseUrl = `http://127.0.0.1:${server.address().port}/api/ho-so/preview/`;
        const get = id => fetch(baseUrl + id, { headers: { 'x-test-auth': '1' } });

        assert.equal((await fetch(baseUrl + '1')).status, 401);
        for (const [id, type, expected] of [[1, 'application/pdf', Buffer.from('%PDF-1.4 test')], [2, 'image/png', png], [8, 'image/jpeg', jpeg], [9, 'image/jpeg', jpeg]]) {
            const response = await get(id);
            assert.equal(response.status, 200);
            assert.match(response.headers.get('content-type'), new RegExp(type));
            assert.equal(response.headers.get('cache-control'), 'no-store');
            assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
        }
        const docResponse = await get(3);
        const document = await docResponse.text();
        assert.equal(docResponse.status, 200);
        assert.match(document, /Example document/);
        assert.doesNotMatch(document, /<script|https:\/\/example\.com/);
        for (const id of [4, 5]) {
            const response = await get(id);
            assert.equal(response.status, 200);
            assert.match(await response.text(), /Example/);
        }
        assert.equal((await get(6)).status, 404);
        assert.equal((await get(7)).status, 415);
        assert.equal((await get(99)).status, 404);
    } finally {
        pool.query = originalQuery;
        mammoth.convertToHtml = originalConvert;
        if (server) await new Promise(resolve => server.close(resolve));
        await pool.end();
        fs.rmSync(directory, { recursive: true, force: true });
    }
});