const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const xaList = [
  { ma_xa: '20242', ten_xa: 'Phường Hải Châu' },
  { ma_xa: '20257', ten_xa: 'Phường Hòa Cường' },
  { ma_xa: '20209', ten_xa: 'Phường Thanh Khê' },
  { ma_xa: '20305', ten_xa: 'Phường An Khê' },
  { ma_xa: '20275', ten_xa: 'Phường An Hải' },
  { ma_xa: '20263', ten_xa: 'Phường Sơn Trà' },
  { ma_xa: '20285', ten_xa: 'Phường Ngũ Hành Sơn' },
  { ma_xa: '20200', ten_xa: 'Phường Hòa Khánh' },
  { ma_xa: '20194', ten_xa: 'Phường Hải Vân' },
  { ma_xa: '20197', ten_xa: 'Phường Liên Chiểu' },
  { ma_xa: '20260', ten_xa: 'Phường Cẩm Lệ' },
  { ma_xa: '20314', ten_xa: 'Phường Hòa Xuân' },
  { ma_xa: '20320', ten_xa: 'Xã Hòa Vang' },
  { ma_xa: '20332', ten_xa: 'Xã Hòa Tiến' },
  { ma_xa: '20308', ten_xa: 'Xã Bà Nà' },
  { ma_xa: '20333', ten_xa: 'Đặc khu Hoàng Sa' },
  { ma_xa: '20965', ten_xa: 'Xã Núi Thành' },
  { ma_xa: '21004', ten_xa: 'Xã Tam Mỹ' },
  { ma_xa: '20984', ten_xa: 'Xã Tam Anh' },
  { ma_xa: '20977', ten_xa: 'Xã Đức Phú' },
  { ma_xa: '20971', ten_xa: 'Xã Tam Xuân' },
  { ma_xa: '20992', ten_xa: 'Xã Tam Hải' },
  { ma_xa: '20341', ten_xa: 'Phường Tam Kỳ' },
  { ma_xa: '20356', ten_xa: 'Phường Quảng Phú' },
  { ma_xa: '20350', ten_xa: 'Phường Hương Trà' },
  { ma_xa: '20335', ten_xa: 'Phường Bàn Thạch' },
  { ma_xa: '20380', ten_xa: 'Xã Tây Hồ' },
  { ma_xa: '20364', ten_xa: 'Xã Chiên Đàn' },
  { ma_xa: '20392', ten_xa: 'Xã Phú Ninh' },
  { ma_xa: '20875', ten_xa: 'Xã Lãnh Ngọc' },
  { ma_xa: '20854', ten_xa: 'Xã Tiên Phước' },
  { ma_xa: '20878', ten_xa: 'Xã Thạnh Bình' },
  { ma_xa: '20857', ten_xa: 'Xã Sơn Cẩm Hà' },
  { ma_xa: '20908', ten_xa: 'Xã Trà Liên' },
  { ma_xa: '20929', ten_xa: 'Xã Trà Giáp' },
  { ma_xa: '20923', ten_xa: 'Xã Trà Tân' },
  { ma_xa: '20920', ten_xa: 'Xã Trà Đốc' },
  { ma_xa: '20900', ten_xa: 'Xã Trà My' },
  { ma_xa: '20944', ten_xa: 'Xã Nam Trà My' },
  { ma_xa: '20941', ten_xa: 'Xã Trà Tập' },
  { ma_xa: '20959', ten_xa: 'Xã Trà Vân' },
  { ma_xa: '20950', ten_xa: 'Xã Trà Linh' },
  { ma_xa: '20938', ten_xa: 'Xã Trà Leng' },
  { ma_xa: '20791', ten_xa: 'Xã Thăng Bình' },
  { ma_xa: '20794', ten_xa: 'Xã Thăng An' },
  { ma_xa: '20836', ten_xa: 'Xã Thăng Trường' },
  { ma_xa: '20848', ten_xa: 'Xã Thăng Điền' },
  { ma_xa: '20827', ten_xa: 'Xã Thăng Phú' },
  { ma_xa: '20818', ten_xa: 'Xã Đồng Dương' },
  { ma_xa: '20662', ten_xa: 'Xã Quế Sơn Trung' },
  { ma_xa: '20641', ten_xa: 'Xã Quế Sơn' },
  { ma_xa: '20650', ten_xa: 'Xã Xuân Phú' },
  { ma_xa: '20656', ten_xa: 'Xã Nông Sơn' },
  { ma_xa: '20669', ten_xa: 'Xã Quế Phước' },
  { ma_xa: '20635', ten_xa: 'Xã Duy Nghĩa' },
  { ma_xa: '20599', ten_xa: 'Xã Nam Phước' },
  { ma_xa: '20623', ten_xa: 'Xã Duy Xuyên' },
  { ma_xa: '20611', ten_xa: 'Xã Thu Bồn' },
  { ma_xa: '20551', ten_xa: 'Phường Điện Bàn' },
  { ma_xa: '20579', ten_xa: 'Phường Điện Bàn Đông' },
  { ma_xa: '20575', ten_xa: 'Phường An Thắng' },
  { ma_xa: '20557', ten_xa: 'Phường Điện Bàn Bắc' },
  { ma_xa: '20569', ten_xa: 'Xã Điện Bàn Tây' },
  { ma_xa: '20587', ten_xa: 'Xã Gò Nổi' },
  { ma_xa: '20410', ten_xa: 'Phường Hội An' },
  { ma_xa: '20413', ten_xa: 'Phường Hội An Đông' },
  { ma_xa: '20401', ten_xa: 'Phường Hội An Tây' },
  { ma_xa: '20434', ten_xa: 'Xã Tân Hiệp' },
  { ma_xa: '20500', ten_xa: 'Xã Đại Lộc' },
  { ma_xa: '20515', ten_xa: 'Xã Hà Nha' },
  { ma_xa: '20506', ten_xa: 'Xã Thượng Đức' },
  { ma_xa: '20539', ten_xa: 'Xã Vu Gia' },
  { ma_xa: '20542', ten_xa: 'Xã Phú Thuận' },
  { ma_xa: '20695', ten_xa: 'Xã Thạnh Mỹ' },
  { ma_xa: '20710', ten_xa: 'Xã Bến Giằng' },
  { ma_xa: '20707', ten_xa: 'Xã Nam Giang' },
  { ma_xa: '20716', ten_xa: 'Xã Đắc Pring' },
  { ma_xa: '20704', ten_xa: 'Xã La Dêê' },
  { ma_xa: '20698', ten_xa: 'Xã La Êê' },
  { ma_xa: '20485', ten_xa: 'Xã Sông Vàng' },
  { ma_xa: '20476', ten_xa: 'Xã Sông Kôn' },
  { ma_xa: '20467', ten_xa: 'Xã Đông Giang' },
  { ma_xa: '20494', ten_xa: 'Xã Bến Hiên' },
  { ma_xa: '20458', ten_xa: 'Xã Avương' },
  { ma_xa: '20455', ten_xa: 'Xã Tây Giang' },
  { ma_xa: '20443', ten_xa: 'Xã Hùng Sơn' },
  { ma_xa: '20779', ten_xa: 'Xã Hiệp Đức' },
  { ma_xa: '20767', ten_xa: 'Xã Việt An' },
  { ma_xa: '20770', ten_xa: 'Xã Phước Trà' },
  { ma_xa: '20722', ten_xa: 'Xã Khâm Đức' },
  { ma_xa: '20734', ten_xa: 'Xã Phước Năng' },
  { ma_xa: '20740', ten_xa: 'Xã Phước Chánh' },
  { ma_xa: '20752', ten_xa: 'Xã Phước Thành' },
  { ma_xa: '20728', ten_xa: 'Xã Phước Hiệp' }
];

const getCapHanhChinh = (tenXa) => {
  const normalized = String(tenXa || '').trim().toLowerCase();
  if (normalized.startsWith('phường')) return 'phuong';
  if (normalized.startsWith('xã')) return 'xa';
  if (normalized.startsWith('thị trấn')) return 'thi_tran';
  return 'xa';
};

async function importDanhMucXa() {
  const connection = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vien_thong_cong_ich'
  });
  await connection.connect();

  let inserted = 0;
  let updated = 0;

  try {
    await connection.query('BEGIN');

    for (const item of xaList) {
      const capHanhChinh = getCapHanhChinh(item.ten_xa);
      const result = await connection.query(
        `INSERT INTO danh_muc_xa (ma_xa, ten_xa, cap_hanh_chinh, trang_thai)
         VALUES ($1, $2, $3, 'dang_hoat_dong')
         ON CONFLICT (ma_xa) DO UPDATE SET
           ten_xa = EXCLUDED.ten_xa,
           cap_hanh_chinh = EXCLUDED.cap_hanh_chinh,
           trang_thai = 'dang_hoat_dong'
         RETURNING (xmax = 0) AS inserted`,
        [item.ma_xa, item.ten_xa, capHanhChinh]
      );

      if (result.rows[0].inserted) inserted += 1;
      else updated += 1;
    }

    const countRows = await connection.query(
      'SELECT COUNT(*) AS total FROM danh_muc_xa WHERE ma_xa = ANY($1)',
      [xaList.map((x) => x.ma_xa)]
    );
    await connection.query('COMMIT');

    console.log('Import danh_muc_xa thanh cong');
    console.log('So ban ghi dau vao:', xaList.length);
    console.log('Them moi:', inserted);
    console.log('Cap nhat:', updated);
    console.log('Tong ma_xa da co trong DB:', Number(countRows.rows[0]?.total || 0));
  } catch (error) {
    await connection.query('ROLLBACK');
    console.error('Import danh_muc_xa that bai:', error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

importDanhMucXa().catch(error => {
  console.error('Import danh_muc_xa that bai:', error.message);
  process.exitCode = 1;
});
