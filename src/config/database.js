// src/config/database.js
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vien_thong_cong_ich',
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

async function ensureRequiredColumns() {
    try {
        const [rows] = await pool.query('SHOW COLUMNS FROM ho_gia_dinh');
        const columns = (rows || []).map(row => row.Field);

        if (!columns.includes('ly_do_tu_choi')) {
            await pool.query('ALTER TABLE ho_gia_dinh ADD COLUMN ly_do_tu_choi TEXT NULL AFTER trang_thai_ho_so');
            console.log('✅ Added missing column: ho_gia_dinh.ly_do_tu_choi');
        }

        if (!columns.includes('trang_thai_ho_so') || !columns.some(column => column === 'trang_thai_ho_so')) {
            await pool.query("ALTER TABLE ho_gia_dinh MODIFY trang_thai_ho_so VARCHAR(50) DEFAULT 'chua_co'");
        }
    } catch (error) {
        console.warn('⚠️ Could not ensure ho_gia_dinh columns:', error.message);
    }
}

pool.getConnection()
    .then(async (connection) => {
        console.log('✅ Database connected successfully');
        connection.release();
        await ensureRequiredColumns();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
    });

module.exports = pool;