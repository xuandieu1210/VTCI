// scripts/seed.js
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Starting seed data...');

        await connection.query(`
            INSERT INTO vnpt_khu_vuc (ma_khu_vuc, ten_khu_vuc) VALUES
            ('KV01', 'Cẩm Lệ'),
            ('KV02', 'Hải Châu'),
            ('KV03', 'Liên Chiểu'),
            ('KV04', 'Ngũ Hành Sơn'),
            ('KV05', 'Tiên Phước'),
            ('KV06', 'Hội An'),
            ('KV07', 'Tam Kỳ'),
            ('KV08', 'Duy Xuyên'),
            ('KV09', 'Quế Sơn'),
            ('KV10', 'Đại Lộc')
            ON DUPLICATE KEY UPDATE
                ten_khu_vuc = VALUES(ten_khu_vuc),
                trang_thai = 'dang_hoat_dong'
        `);
        console.log('✅ Seeded: vnpt_khu_vuc');

        await connection.query(`
            INSERT IGNORE INTO loai_doi_tuong (ma_loai, ten_loai, thu_tu_uu_tien) VALUES
            ('HNT', 'Ho ngheo', 1),
            ('HCN', 'Ho can ngheo', 2),
            ('CS', 'Doi tuong chinh sach', 3),
            ('BTXH', 'Doi tuong bao tro xa hoi', 4),
            ('KH', 'Ho khac', 5)
        `);
        console.log('✅ Seeded: loai_doi_tuong');

        await connection.query(`
            INSERT IGNORE INTO loai_dich_vu (ma_dich_vu, ten_dich_vu, loai_hinh) VALUES
            ('DMDD', 'Di dong mat dat', 'di_dong_mat_dat'),
            ('IBRCD', 'Internet bang rong co dinh', 'internet_brcd'),
            ('DTCD', 'Dien thoai co dinh', 'dien_thoai_co_dinh')
        `);
        console.log('✅ Seeded: loai_dich_vu');

        const hashedPassword = await bcrypt.hash('admin123', 10);
        await connection.query(`
            INSERT IGNORE INTO users (username, password, ho_ten, email, vai_tro, trang_thai)
            VALUES ('admin', ?, 'Administrator', 'admin@system.com', 'admin', 'dang_hoat_dong')
        `, [hashedPassword]);
        console.log('✅ Seeded: users (admin)');

        await connection.query(`
            INSERT IGNORE INTO cau_hinh_he_thong (ma_cau_hinh, ten_cau_hinh, gia_tri, loai_du_lieu, nhom) VALUES
            ('HO_SO_DINH_KEM', 'Cac loai ho so dinh kem', '["CMND","Ho_khau","Giay_chung_nhan_ngheo"]', 'json', 'ho_so'),
            ('DINH_DANG_HO_SO', 'Dinh dang ho so cho phep', '["pdf","jpg","png","jpeg","docx","xlsx"]', 'json', 'ho_so'),
            ('MAX_FILE_SIZE', 'Dung luong toi da file (MB)', '10', 'number', 'upload')
        `);
        console.log('✅ Seeded: cau_hinh_he_thong');

        console.log('✅ Seed data completed successfully!');
        console.log('📝 Admin account: admin / admin123');
    } catch (error) {
        console.error('❌ Seed failed:', error);
    } finally {
        await connection.end();
    }
}

seed();