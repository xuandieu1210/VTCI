// server.js
const app = require('./src/app');
const dotenv = require('dotenv');
const os = require('os');

dotenv.config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Tao cac thu muc can thiet
const fs = require('fs');
const path = require('path');

const directories = ['uploads', 'uploads/ho_so', 'uploads/import_temp', 'exports'];
directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('📁 Created directory: ' + dir);
    }
});

const getLanIps = () => {
    const interfaces = os.networkInterfaces();
    const ips = [];
    Object.values(interfaces).forEach((items) => {
        (items || []).forEach((item) => {
            if (item && item.family === 'IPv4' && !item.internal) {
                ips.push(item.address);
            }
        });
    });
    return ips;
};

const server = app.listen(PORT, HOST, () => {
    const lanIps = getLanIps();
    console.log('=========================================');
    console.log('🚀 Server is running on ' + HOST + ':' + PORT);
    console.log('📊 Web URL: http://localhost:' + PORT);
    console.log('📊 API URL: http://localhost:' + PORT + '/api');
    lanIps.forEach((ip) => {
        console.log('🌐 LAN URL: http://' + ip + ':' + PORT);
    });
    console.log('=========================================');
});

process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received: closing HTTP server');
    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received: closing HTTP server');
    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });
});

module.exports = server;