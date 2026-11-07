const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
    const connection = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'vien_thong_cong_ich'
    });
    await connection.connect();
    try {
        await connection.query('BEGIN');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS vnpt_khu_vuc (
                id SERIAL PRIMARY KEY, ma_khu_vuc VARCHAR(20) UNIQUE NOT NULL,
                ten_khu_vuc VARCHAR(100) NOT NULL, mo_ta TEXT,
                trang_thai VARCHAR(20) DEFAULT 'dang_hoat_dong' CHECK (trang_thai IN ('dang_hoat_dong', 'ngung_hoat_dong')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS danh_muc_xa (
                id SERIAL PRIMARY KEY, ma_xa VARCHAR(20) UNIQUE NOT NULL, ten_xa VARCHAR(100) NOT NULL,
                ten_xa_cu VARCHAR(100), vnpt_khu_vuc_id INT REFERENCES vnpt_khu_vuc(id) ON DELETE SET NULL,
                cap_hanh_chinh VARCHAR(20) DEFAULT 'xa' CHECK (cap_hanh_chinh IN ('phuong', 'xa', 'thi_tran')),
                ma_hanh_chinh VARCHAR(20), trang_thai VARCHAR(20) DEFAULT 'dang_hoat_dong' CHECK (trang_thai IN ('dang_hoat_dong', 'ngung_hoat_dong')),
                ghi_chu TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS loai_doi_tuong (
                id SERIAL PRIMARY KEY, ma_loai VARCHAR(20) UNIQUE NOT NULL, ten_loai VARCHAR(100) NOT NULL,
                mo_ta TEXT, thu_tu_uu_tien INT DEFAULT 0,
                trang_thai VARCHAR(20) DEFAULT 'dang_hoat_dong' CHECK (trang_thai IN ('dang_hoat_dong', 'ngung_hoat_dong')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS loai_dich_vu (
                id SERIAL PRIMARY KEY, ma_dich_vu VARCHAR(20) UNIQUE NOT NULL, ten_dich_vu VARCHAR(100) NOT NULL,
                loai_hinh VARCHAR(30) NOT NULL CHECK (loai_hinh IN ('', 'di_dong_mat_dat', 'internet_brcd', 'dien_thoai_co_dinh')),
                mo_ta TEXT, goi_cuoc_mac_dinh VARCHAR(50),
                trang_thai VARCHAR(20) DEFAULT 'dang_hoat_dong' CHECK (trang_thai IN ('dang_hoat_dong', 'ngung_hoat_dong')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE loai_dich_vu DROP CONSTRAINT IF EXISTS loai_dich_vu_loai_hinh_check;
            ALTER TABLE loai_dich_vu ADD CONSTRAINT loai_dich_vu_loai_hinh_check CHECK (loai_hinh IN ('', 'di_dong_mat_dat', 'internet_brcd', 'dien_thoai_co_dinh'));
            CREATE TABLE IF NOT EXISTS ho_gia_dinh (
                id SERIAL PRIMARY KEY, ma_ho VARCHAR(50) UNIQUE NOT NULL, ten_chu_ho VARCHAR(100) NOT NULL,
                so_cmnd VARCHAR(20) UNIQUE NOT NULL, ngay_sinh DATE,
                gioi_tinh VARCHAR(10) CHECK (gioi_tinh IN ('nam', 'nu', 'khac')), dia_chi_chi_tiet VARCHAR(255),
                xa_id INT NOT NULL REFERENCES danh_muc_xa(id),
                loai_doi_tuong_id INT REFERENCES loai_doi_tuong(id) ON DELETE SET NULL,
                vnpt_khu_vuc_id INT REFERENCES vnpt_khu_vuc(id) ON DELETE SET NULL, so_thue_bao_chinh VARCHAR(20),
                trang_thai_ho VARCHAR(20) DEFAULT 'dang_hoat_dong' CHECK (trang_thai_ho IN ('dang_hoat_dong', 'ngung_hoat_dong', 'cho_kich_hoat', 'huy_bo')),
                trang_thai_ho_so VARCHAR(50) DEFAULT 'chua_co', nam_xet_duyet INT, ly_do_tu_choi TEXT, ghi_chu TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS thanh_vien (
                id SERIAL PRIMARY KEY, ho_gia_dinh_id INT NOT NULL REFERENCES ho_gia_dinh(id) ON DELETE CASCADE,
                ho_ten VARCHAR(100) NOT NULL, so_cmnd VARCHAR(20) UNIQUE, ngay_sinh DATE,
                gioi_tinh VARCHAR(10) CHECK (gioi_tinh IN ('nam', 'nu', 'khac')),
                quan_he_chu_ho VARCHAR(50), so_dien_thoai VARCHAR(20), email VARCHAR(100), nghe_nghiep VARCHAR(100), ghi_chu TEXT,
                dung_dich_vu SMALLINT DEFAULT 0, la_chu_ho_dung_dich_vu SMALLINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS thue_bao_dich_vu (
                id SERIAL PRIMARY KEY, ho_gia_dinh_id INT NOT NULL REFERENCES ho_gia_dinh(id) ON DELETE CASCADE,
                thanh_vien_id INT REFERENCES thanh_vien(id) ON DELETE SET NULL,
                loai_dich_vu_id INT NOT NULL REFERENCES loai_dich_vu(id), so_thue_bao VARCHAR(20) UNIQUE NOT NULL,
                ten_chu_thue_bao VARCHAR(100), cmnd_chu_thue_bao VARCHAR(20), goi_cuoc_dang_ky VARCHAR(50),
                ngay_dang_ky DATE, ngay_kich_hoat DATE, ngay_het_han DATE,
                trang_thai_dich_vu VARCHAR(20) DEFAULT 'cho_kich_hoat' CHECK (trang_thai_dich_vu IN ('dang_hoat_dong', 'tam_ngung', 'da_huy', 'cho_kich_hoat')),
                ghi_chu TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS ho_so_dinh_kem (
                id SERIAL PRIMARY KEY, ho_gia_dinh_id INT NOT NULL REFERENCES ho_gia_dinh(id) ON DELETE CASCADE,
                thanh_vien_id INT REFERENCES thanh_vien(id) ON DELETE SET NULL, loai_ho_so VARCHAR(50) NOT NULL,
                nam_ho_so INT, ten_file VARCHAR(255) NOT NULL, duong_dan_file VARCHAR(500) NOT NULL,
                dung_luong BIGINT, dinh_dang VARCHAR(20), ngay_het_han DATE,
                trang_thai VARCHAR(20) DEFAULT 'con_hieu_luc' CHECK (trang_thai IN ('con_hieu_luc', 'het_han', 'can_bo_sung')),
                nguoi_tai_len VARCHAR(100), mo_ta TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL,
                ho_ten VARCHAR(100) NOT NULL, email VARCHAR(100) UNIQUE, so_dien_thoai VARCHAR(20),
                vai_tro VARCHAR(20) DEFAULT 'staff' CHECK (vai_tro IN ('admin', 'manager', 'staff', 'vnpt_khu_vuc')),
                xa_quan_ly_id INT REFERENCES danh_muc_xa(id) ON DELETE SET NULL,
                vnpt_khu_vuc_id INT REFERENCES vnpt_khu_vuc(id) ON DELETE SET NULL, quyen_chuc_nang TEXT,
                trang_thai VARCHAR(20) DEFAULT 'dang_hoat_dong' CHECK (trang_thai IN ('dang_hoat_dong', 'khoa')),
                last_login TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS lich_su_thay_doi (
                id SERIAL PRIMARY KEY, bang VARCHAR(50) NOT NULL, record_id INT NOT NULL,
                hanh_dong VARCHAR(20) NOT NULL CHECK (hanh_dong IN ('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'RESTORE')),
                nguoi_thuc_hien_id INT REFERENCES users(id) ON DELETE SET NULL, noi_dung_cu JSON, noi_dung_moi JSON,
                ip_address VARCHAR(45), user_agent TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS import_log (
                id SERIAL PRIMARY KEY, ten_file VARCHAR(255) NOT NULL,
                loai_import VARCHAR(20) NOT NULL CHECK (loai_import IN ('ho_gia_dinh', 'thanh_vien', 'thue_bao', 'ho_so', 'full')),
                tong_so_dong INT DEFAULT 0, so_luong_thanh_cong INT DEFAULT 0, so_luong_that_bai INT DEFAULT 0, so_luong_cap_nhat INT DEFAULT 0,
                trang_thai VARCHAR(20) DEFAULT 'dang_xu_ly' CHECK (trang_thai IN ('dang_xu_ly', 'thanh_cong', 'that_bai', 'da_huy')),
                loi_chi_tiet JSON, duong_dan_file_tam VARCHAR(500), nguoi_import_id INT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS canh_bao (
                id SERIAL PRIMARY KEY,
                loai_canh_bao VARCHAR(30) NOT NULL CHECK (loai_canh_bao IN ('trung_cmnd', 'trung_thue_bao', 'trung_ho', 'thieu_thong_tin', 'thieu_ho_so', 'sai_dia_ban', 'ho_so_het_han', 'ho_so_sap_het_han')),
                mo_ta TEXT NOT NULL, do_uu_tien VARCHAR(20) DEFAULT 'trung_binh' CHECK (do_uu_tien IN ('cao', 'trung_binh', 'thap')),
                trang_thai VARCHAR(20) DEFAULT 'moi' CHECK (trang_thai IN ('moi', 'dang_xu_ly', 'da_xu_ly', 'da_dong')),
                ho_gia_dinh_id INT REFERENCES ho_gia_dinh(id) ON DELETE CASCADE,
                thanh_vien_id INT REFERENCES thanh_vien(id) ON DELETE CASCADE,
                thue_bao_id INT REFERENCES thue_bao_dich_vu(id) ON DELETE CASCADE,
                nguoi_phat_hien_id INT REFERENCES users(id) ON DELETE SET NULL,
                nguoi_xu_ly_id INT REFERENCES users(id) ON DELETE SET NULL,
                ghi_chu_xu_ly TEXT, ngay_phat_hien TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ngay_xu_ly TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS cau_hinh_he_thong (
                id SERIAL PRIMARY KEY, ma_cau_hinh VARCHAR(50) UNIQUE NOT NULL, ten_cau_hinh VARCHAR(100) NOT NULL,
                gia_tri TEXT, loai_du_lieu VARCHAR(20) DEFAULT 'text' CHECK (loai_du_lieu IN ('text', 'number', 'boolean', 'json', 'file')),
                mo_ta TEXT, nhom VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
            BEGIN
                IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        for (const table of ['vnpt_khu_vuc', 'danh_muc_xa', 'loai_doi_tuong', 'loai_dich_vu', 'ho_gia_dinh', 'thanh_vien', 'thue_bao_dich_vu', 'ho_so_dinh_kem', 'users', 'import_log', 'canh_bao', 'cau_hinh_he_thong']) {
            await connection.query(`ALTER TABLE ${table} ALTER COLUMN created_at SET NOT NULL, ALTER COLUMN updated_at SET NOT NULL`);
            await connection.query(`DROP TRIGGER IF EXISTS set_updated_at ON ${table}`);
            await connection.query(`CREATE TRIGGER set_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);
        }
        await connection.query('ALTER TABLE lich_su_thay_doi ALTER COLUMN created_at SET NOT NULL');
        await connection.query('ALTER TABLE canh_bao ALTER COLUMN ngay_phat_hien SET NOT NULL');
        await connection.query('ALTER TABLE ho_gia_dinh ADD COLUMN IF NOT EXISTS nam_xet_duyet INT');
        await connection.query('ALTER TABLE ho_gia_dinh DISABLE TRIGGER set_updated_at');
        await connection.query("UPDATE ho_gia_dinh SET nam_xet_duyet = EXTRACT(YEAR FROM updated_at)::integer WHERE nam_xet_duyet IS NULL AND trang_thai_ho_so IN ('day_du', 'tu_choi')");
        await connection.query('ALTER TABLE ho_gia_dinh ENABLE TRIGGER set_updated_at');
        await connection.query('CREATE INDEX IF NOT EXISTS ho_so_dinh_kem_ho_loai_nam_idx ON ho_so_dinh_kem (ho_gia_dinh_id, loai_ho_so, nam_ho_so)');
        await connection.query('ALTER TABLE ho_gia_dinh ALTER COLUMN trang_thai_ho_so SET NOT NULL');
        await connection.query('ALTER TABLE ho_so_dinh_kem ALTER COLUMN nam_ho_so SET DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer, ALTER COLUMN nam_ho_so SET NOT NULL');
        await connection.query('COMMIT');
        console.log('Database migration completed successfully.');
    } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
    } finally {
        await connection.end();
    }
}

migrate().catch(error => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
});