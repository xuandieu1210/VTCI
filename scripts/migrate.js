// scripts/migrate.js
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Starting database migration...');
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS vnpt_khu_vuc (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ma_khu_vuc VARCHAR(20) UNIQUE NOT NULL,
                ten_khu_vuc VARCHAR(100) NOT NULL,
                mo_ta TEXT,
                trang_thai ENUM('dang_hoat_dong', 'ngung_hoat_dong') DEFAULT 'dang_hoat_dong',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created: vnpt_khu_vuc');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS danh_muc_xa (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ma_xa VARCHAR(20) UNIQUE NOT NULL,
                ten_xa VARCHAR(100) NOT NULL,
                ten_xa_cu VARCHAR(100),
                vnpt_khu_vuc_id INT,
                cap_hanh_chinh ENUM('phuong', 'xa', 'thi_tran') DEFAULT 'xa',
                ma_hanh_chinh VARCHAR(20),
                trang_thai ENUM('dang_hoat_dong', 'ngung_hoat_dong') DEFAULT 'dang_hoat_dong',
                ghi_chu TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (vnpt_khu_vuc_id) REFERENCES vnpt_khu_vuc(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Created: danh_muc_xa');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS loai_doi_tuong (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ma_loai VARCHAR(20) UNIQUE NOT NULL,
                ten_loai VARCHAR(100) NOT NULL,
                mo_ta TEXT,
                thu_tu_uu_tien INT DEFAULT 0,
                trang_thai ENUM('dang_hoat_dong', 'ngung_hoat_dong') DEFAULT 'dang_hoat_dong',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created: loai_doi_tuong');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS loai_dich_vu (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ma_dich_vu VARCHAR(20) UNIQUE NOT NULL,
                ten_dich_vu VARCHAR(100) NOT NULL,
                loai_hinh ENUM('di_dong_mat_dat', 'internet_brcd', 'dien_thoai_co_dinh') NOT NULL,
                mo_ta TEXT,
                goi_cuoc_mac_dinh VARCHAR(50),
                trang_thai ENUM('dang_hoat_dong', 'ngung_hoat_dong') DEFAULT 'dang_hoat_dong',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created: loai_dich_vu');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS ho_gia_dinh (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ma_ho VARCHAR(50) UNIQUE NOT NULL,
                ten_chu_ho VARCHAR(100) NOT NULL,
                so_cmnd VARCHAR(20) UNIQUE NOT NULL,
                ngay_sinh DATE,
                gioi_tinh ENUM('nam', 'nu', 'khac'),
                dia_chi_chi_tiet VARCHAR(255),
                xa_id INT NOT NULL,
                loai_doi_tuong_id INT,
                vnpt_khu_vuc_id INT,
                so_thue_bao_chinh VARCHAR(20),
                trang_thai_ho ENUM('dang_hoat_dong', 'ngung_hoat_dong', 'cho_kich_hoat', 'huy_bo') DEFAULT 'dang_hoat_dong',
                trang_thai_ho_so VARCHAR(50) DEFAULT 'chua_co',
                ly_do_tu_choi TEXT,
                ghi_chu TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (xa_id) REFERENCES danh_muc_xa(id),
                FOREIGN KEY (loai_doi_tuong_id) REFERENCES loai_doi_tuong(id) ON DELETE SET NULL,
                FOREIGN KEY (vnpt_khu_vuc_id) REFERENCES vnpt_khu_vuc(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Created: ho_gia_dinh');

        await connection.query(`
            ALTER TABLE ho_gia_dinh
            MODIFY trang_thai_ho_so VARCHAR(50) DEFAULT 'chua_co',
            ADD COLUMN IF NOT EXISTS ly_do_tu_choi TEXT NULL
        `);
        console.log('✅ Updated: ho_gia_dinh has ly_do_tu_choi field');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS thanh_vien (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ho_gia_dinh_id INT NOT NULL,
                ho_ten VARCHAR(100) NOT NULL,
                so_cmnd VARCHAR(20) UNIQUE,
                ngay_sinh DATE,
                gioi_tinh ENUM('nam', 'nu', 'khac'),
                quan_he_chu_ho VARCHAR(50),
                so_dien_thoai VARCHAR(20),
                email VARCHAR(100),
                nghe_nghiep VARCHAR(100),
                ghi_chu TEXT,
                dung_dich_vu TINYINT(1) DEFAULT 0,
                la_chu_ho_dung_dich_vu TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (ho_gia_dinh_id) REFERENCES ho_gia_dinh(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Created: thanh_vien');

        await connection.query(`
            ALTER TABLE thanh_vien
                ADD COLUMN IF NOT EXISTS dung_dich_vu TINYINT(1) DEFAULT 0,
                ADD COLUMN IF NOT EXISTS la_chu_ho_dung_dich_vu TINYINT(1) DEFAULT 0
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS thue_bao_dich_vu (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ho_gia_dinh_id INT NOT NULL,
                thanh_vien_id INT NULL,
                loai_dich_vu_id INT NOT NULL,
                so_thue_bao VARCHAR(20) UNIQUE NOT NULL,
                ten_chu_thue_bao VARCHAR(100),
                cmnd_chu_thue_bao VARCHAR(20),
                goi_cuoc_dang_ky VARCHAR(50),
                ngay_dang_ky DATE,
                ngay_kich_hoat DATE,
                ngay_het_han DATE,
                trang_thai_dich_vu ENUM('dang_hoat_dong', 'tam_ngung', 'da_huy', 'cho_kich_hoat') DEFAULT 'cho_kich_hoat',
                ghi_chu TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (ho_gia_dinh_id) REFERENCES ho_gia_dinh(id) ON DELETE CASCADE,
                FOREIGN KEY (thanh_vien_id) REFERENCES thanh_vien(id) ON DELETE SET NULL,
                FOREIGN KEY (loai_dich_vu_id) REFERENCES loai_dich_vu(id)
            )
        `);
        console.log('✅ Created: thue_bao_dich_vu');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS ho_so_dinh_kem (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ho_gia_dinh_id INT NOT NULL,
                thanh_vien_id INT NULL,
                loai_ho_so VARCHAR(50) NOT NULL,
                nam_ho_so INT NULL,
                ten_file VARCHAR(255) NOT NULL,
                duong_dan_file VARCHAR(500) NOT NULL,
                dung_luong BIGINT,
                dinh_dang VARCHAR(20),
                ngay_het_han DATE,
                trang_thai ENUM('con_hieu_luc', 'het_han', 'can_bo_sung') DEFAULT 'con_hieu_luc',
                nguoi_tai_len VARCHAR(100),
                mo_ta TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (ho_gia_dinh_id) REFERENCES ho_gia_dinh(id) ON DELETE CASCADE,
                FOREIGN KEY (thanh_vien_id) REFERENCES thanh_vien(id) ON DELETE SET NULL
            )
        `);

        const [namHoSoColumns] = await connection.query("SHOW COLUMNS FROM ho_so_dinh_kem LIKE 'nam_ho_so'");
        if (!namHoSoColumns.length) {
            await connection.query('ALTER TABLE ho_so_dinh_kem ADD COLUMN nam_ho_so INT NULL AFTER loai_ho_so');
        }
        console.log('✅ Created: ho_so_dinh_kem');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                ho_ten VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE,
                so_dien_thoai VARCHAR(20),
                vai_tro ENUM('admin', 'manager', 'staff', 'vnpt_khu_vuc') DEFAULT 'staff',
                xa_quan_ly_id INT NULL,
                vnpt_khu_vuc_id INT NULL,
                quyen_chuc_nang TEXT NULL,
                trang_thai ENUM('dang_hoat_dong', 'khoa') DEFAULT 'dang_hoat_dong',
                last_login TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (xa_quan_ly_id) REFERENCES danh_muc_xa(id) ON DELETE SET NULL,
                FOREIGN KEY (vnpt_khu_vuc_id) REFERENCES vnpt_khu_vuc(id) ON DELETE SET NULL
            )
        `);
        const [quyenColumn] = await connection.query("SHOW COLUMNS FROM users LIKE 'quyen_chuc_nang'");
        if (!quyenColumn.length) {
            await connection.query('ALTER TABLE users ADD COLUMN quyen_chuc_nang TEXT NULL AFTER vnpt_khu_vuc_id');
        }
        const [roleColumn] = await connection.query("SHOW COLUMNS FROM users LIKE 'vai_tro'");
        if (roleColumn.length && !String(roleColumn[0].Type).includes('vnpt_khu_vuc')) {
            await connection.query("ALTER TABLE users MODIFY vai_tro ENUM('admin', 'manager', 'staff', 'vnpt_khu_vuc') DEFAULT 'staff'");
        }
        console.log('✅ Created: users');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS lich_su_thay_doi (
                id INT PRIMARY KEY AUTO_INCREMENT,
                bang VARCHAR(50) NOT NULL,
                record_id INT NOT NULL,
                hanh_dong ENUM('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'RESTORE') NOT NULL,
                nguoi_thuc_hien_id INT,
                noi_dung_cu JSON,
                noi_dung_moi JSON,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (nguoi_thuc_hien_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Created: lich_su_thay_doi');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS import_log (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ten_file VARCHAR(255) NOT NULL,
                loai_import ENUM('ho_gia_dinh', 'thanh_vien', 'thue_bao', 'ho_so', 'full') NOT NULL,
                tong_so_dong INT DEFAULT 0,
                so_luong_thanh_cong INT DEFAULT 0,
                so_luong_that_bai INT DEFAULT 0,
                so_luong_cap_nhat INT DEFAULT 0,
                trang_thai ENUM('dang_xu_ly', 'thanh_cong', 'that_bai', 'da_huy') DEFAULT 'dang_xu_ly',
                loi_chi_tiet JSON,
                duong_dan_file_tam VARCHAR(500),
                nguoi_import_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (nguoi_import_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Created: import_log');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS canh_bao (
                id INT PRIMARY KEY AUTO_INCREMENT,
                loai_canh_bao ENUM('trung_cmnd', 'trung_thue_bao', 'trung_ho', 'thieu_thong_tin', 
                                   'thieu_ho_so', 'sai_dia_ban', 'ho_so_het_han', 'ho_so_sap_het_han') NOT NULL,
                mo_ta TEXT NOT NULL,
                do_uu_tien ENUM('cao', 'trung_binh', 'thap') DEFAULT 'trung_binh',
                trang_thai ENUM('moi', 'dang_xu_ly', 'da_xu_ly', 'da_dong') DEFAULT 'moi',
                ho_gia_dinh_id INT,
                thanh_vien_id INT,
                thue_bao_id INT,
                nguoi_phat_hien_id INT,
                nguoi_xu_ly_id INT,
                ghi_chu_xu_ly TEXT,
                ngay_phat_hien TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ngay_xu_ly TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (ho_gia_dinh_id) REFERENCES ho_gia_dinh(id) ON DELETE CASCADE,
                FOREIGN KEY (thanh_vien_id) REFERENCES thanh_vien(id) ON DELETE CASCADE,
                FOREIGN KEY (thue_bao_id) REFERENCES thue_bao_dich_vu(id) ON DELETE CASCADE,
                FOREIGN KEY (nguoi_phat_hien_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (nguoi_xu_ly_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Created: canh_bao');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS cau_hinh_he_thong (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ma_cau_hinh VARCHAR(50) UNIQUE NOT NULL,
                ten_cau_hinh VARCHAR(100) NOT NULL,
                gia_tri TEXT,
                loai_du_lieu ENUM('text', 'number', 'boolean', 'json', 'file') DEFAULT 'text',
                mo_ta TEXT,
                nhom VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created: cau_hinh_he_thong');

        console.log('✅ Database migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();