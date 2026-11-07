const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

async function run() {
    const connection = new Client({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'vien_thong_cong_ich',
        port: Number(process.env.DB_PORT) || 5432
    });
    await connection.connect();

    try {
        await connection.query('BEGIN');
        await connection.query('ALTER TABLE ho_gia_dinh DROP COLUMN IF EXISTS thon_id');
        await connection.query('DROP TABLE IF EXISTS danh_muc_thon');
        const tableCheck = await connection.query("SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'danh_muc_thon'");
        const columnCheck = await connection.query("SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'ho_gia_dinh' AND column_name = 'thon_id'");
        await connection.query('COMMIT');
        console.log('Verify table exists:', tableCheck.rowCount > 0);
        console.log('Verify column exists:', columnCheck.rowCount > 0);

        const statusPath = path.join(__dirname, '../exports/drop-thon-status.json');
        fs.mkdirSync(path.dirname(statusPath), { recursive: true });
        fs.writeFileSync(statusPath, JSON.stringify({
            tableExists: tableCheck.rowCount > 0,
            thonColumnExists: columnCheck.rowCount > 0,
            updatedAt: new Date().toISOString()
        }, null, 2));
    } catch (error) {
        await connection.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        await connection.end();
    }
}

run().catch((error) => {
    console.error('Drop failed:', error.message);
    process.exit(1);
});
