const { Pool, types } = require('pg');
require('dotenv').config();

types.setTypeParser(20, value => Number(value));

const postgresPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vien_thong_cong_ich',
    port: Number(process.env.DB_PORT) || 5432,
    max: 10
});

async function query(client, sql, params = []) {
    let parameterIndex = 0;
    const text = sql.replace(/\?/g, () => `$${++parameterIndex}`);
    const insert = /^\s*INSERT\s+INTO\b/i.test(text);
    const result = await client.query(insert ? `${text.trim().replace(/;$/, '')} RETURNING id` : text, params);
    if (insert) return [{ insertId: result.rows[0]?.id, affectedRows: result.rowCount }];
    if (result.command === 'UPDATE' || result.command === 'DELETE') return [{ affectedRows: result.rowCount }];
    return [result.rows];
}

module.exports = {
    query: (sql, params) => query(postgresPool, sql, params),
    getConnection: async () => {
        const client = await postgresPool.connect();
        return {
            query: (sql, params) => query(client, sql, params),
            beginTransaction: () => client.query('BEGIN'),
            commit: () => client.query('COMMIT'),
            rollback: () => client.query('ROLLBACK'),
            release: () => client.release()
        };
    },
    end: () => postgresPool.end()
};