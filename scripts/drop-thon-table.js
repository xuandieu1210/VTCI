const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT || 3306)
    });

    try {
        const [fkRows] = await connection.query(
            "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ho_gia_dinh' AND COLUMN_NAME = 'thon_id' AND REFERENCED_TABLE_NAME = 'danh_muc_thon'"
        );

        if (fkRows.length > 0) {
            const fkName = fkRows[0].CONSTRAINT_NAME;
            await connection.query('ALTER TABLE ho_gia_dinh DROP FOREIGN KEY ' + fkName);
            console.log('Dropped foreign key:', fkName);
        } else {
            console.log('No foreign key from ho_gia_dinh.thon_id to danh_muc_thon found.');
        }

        const [columnRows] = await connection.query("SHOW COLUMNS FROM ho_gia_dinh LIKE 'thon_id'");
        if (columnRows.length > 0) {
            await connection.query('ALTER TABLE ho_gia_dinh DROP COLUMN thon_id');
            console.log('Dropped column: ho_gia_dinh.thon_id');
        } else {
            console.log('Column ho_gia_dinh.thon_id not found.');
        }

        await connection.query('DROP TABLE IF EXISTS danh_muc_thon');
        console.log('Dropped table: danh_muc_thon');

        const [tableCheck] = await connection.query("SHOW TABLES LIKE 'danh_muc_thon'");
        const [columnCheck] = await connection.query("SHOW COLUMNS FROM ho_gia_dinh LIKE 'thon_id'");
        console.log('Verify table exists:', tableCheck.length > 0);
        console.log('Verify column exists:', columnCheck.length > 0);

        const statusPath = path.join(__dirname, '../exports/drop-thon-status.json');
        fs.mkdirSync(path.dirname(statusPath), { recursive: true });
        fs.writeFileSync(statusPath, JSON.stringify({
            tableExists: tableCheck.length > 0,
            thonColumnExists: columnCheck.length > 0,
            updatedAt: new Date().toISOString()
        }, null, 2));
    } finally {
        await connection.end();
    }
}

run().catch((error) => {
    console.error('Drop failed:', error.message);
    process.exit(1);
});
