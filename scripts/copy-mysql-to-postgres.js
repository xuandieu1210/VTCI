const mysql = require('mysql2/promise');
const { Client } = require('pg');
require('dotenv').config();

const tables = [
    'vnpt_khu_vuc', 'danh_muc_xa', 'loai_doi_tuong', 'loai_dich_vu',
    'ho_gia_dinh', 'thanh_vien', 'thue_bao_dich_vu', 'ho_so_dinh_kem',
    'users', 'lich_su_thay_doi', 'import_log', 'canh_bao', 'cau_hinh_he_thong'
];

async function copy() {
    if (!process.env.MYSQL_DATABASE) throw new Error('MYSQL_DATABASE is required');
    const source = await mysql.createConnection({
        host: process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE,
        dateStrings: true
    });
    const target = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'vien_thong_cong_ich'
    });
    try {
        await target.connect();
        await source.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await source.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        await target.query('BEGIN');
        for (const table of tables) {
            const existing = await target.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
            if (existing.rows[0].count !== 0) throw new Error(`Target table ${table} is not empty`);
        }
        for (const table of tables) {
            const [columns] = await source.query(
                'SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [table]
            );
            if (!columns.length) throw new Error(`Source table ${table} is missing`);
            const names = columns.map(column => column.COLUMN_NAME);
            const targetColumns = await target.query(
                'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1', [table]
            );
            const targetNames = new Set(targetColumns.rows.map(column => column.column_name));
            const missing = names.filter(name => !targetNames.has(name));
            if (missing.length) throw new Error(`Target table ${table} is missing columns: ${missing.join(', ')}`);
            const [rows] = await source.query(`SELECT * FROM \`${table}\``);
            for (let offset = 0; offset < rows.length; offset += 100) {
                const batch = rows.slice(offset, offset + 100);
                const values = [];
                const placeholders = batch.map(row => `(${names.map(name => {
                    values.push(row[name]);
                    return `$${values.length}`;
                }).join(', ')})`);
                await target.query(`INSERT INTO "${table}" (${names.map(name => `"${name}"`).join(', ')}) VALUES ${placeholders.join(', ')}`, values);
            }
            const result = await target.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
            if (result.rows[0].count !== rows.length) throw new Error(`Row count mismatch for ${table}`);
            console.log(`${table}: ${rows.length} rows`);
        }
        for (const table of tables) {
            await target.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE(MAX(id), 1), COUNT(*) > 0) FROM "${table}"`, [table]);
        }
        await target.query('COMMIT');
        await source.query('ROLLBACK');
        console.log('Data copy completed successfully.');
    } catch (error) {
        await target.query('ROLLBACK').catch(() => {});
        await source.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        await source.end();
        await target.end();
    }
}

copy().catch(error => {
    console.error('Data copy failed:', error.message);
    process.exitCode = 1;
});