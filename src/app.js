// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// ============ View Engine Setup ============
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============ Static Files ============
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/exports', express.static(path.join(__dirname, '../exports')));

// ============ Session ============
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ============ Middlewares ============
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*', credentials: true }));
app.use(compression());
app.use(morgan('combined'));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Qua nhieu yeu cau, vui long thu lai sau' }
});
app.use('/api', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============ Routes ============
const authRoutes = require('./routes/authRoutes');
const danhMucRoutes = require('./routes/danhMucRoutes');
const hoGiaDinhRoutes = require('./routes/hoGiaDinhRoutes');
const thanhVienRoutes = require('./routes/thanhVienRoutes');
const thueBaoRoutes = require('./routes/thueBaoRoutes');
const hoSoRoutes = require('./routes/hoSoRoutes');
const importRoutes = require('./routes/importRoutes');
const exportRoutes = require('./routes/exportRoutes');
const traCuuRoutes = require('./routes/traCuuRoutes');
const thongKeRoutes = require('./routes/thongKeRoutes');
const cauHinhRoutes = require('./routes/cauHinhRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/danh-muc', danhMucRoutes);
app.use('/api/ho-gia-dinh', hoGiaDinhRoutes);
app.use('/api/thanh-vien', thanhVienRoutes);
app.use('/api/thue-bao', thueBaoRoutes);
app.use('/api/ho-so', hoSoRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/tra-cuu', traCuuRoutes);
app.use('/api/thong-ke', thongKeRoutes);
app.use('/api/cau-hinh', cauHinhRoutes);

const webRoutes = require('./routes/webRoutes');
app.use('/', webRoutes);

app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'He thong dang hoat dong',
        timestamp: new Date().toISOString()
    });
});

app.use((req, res) => {
    res.status(404).render('pages/404', { 
        title: '404 - Khong tim thay trang',
        user: req.session.user || null
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).render('pages/error', {
        title: 'Loi he thong',
        message: err.message || 'Co loi xay ra',
        user: req.session.user || null
    });
});

module.exports = app;