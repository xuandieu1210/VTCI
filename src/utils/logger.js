// src/utils/logger.js
const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...(data && { data })
        };
        
        const logLine = JSON.stringify(logEntry) + '
';
        const logFile = path.join(this.logDir, level + '.log');
        fs.appendFile(logFile, logLine, (err) => {
            if (err) console.error('Log error:', err);
        });

        // Also log to console in development
        if (process.env.NODE_ENV === 'development') {
            const color = this.getColor(level);
            console.log(color + '[' + timestamp + '] ' + level.toUpperCase() + ': ' + message + '[0m');
            if (data) {
                console.log('   Data:', JSON.stringify(data, null, 2));
            }
        }
    }

    getColor(level) {
        const colors = {
            info: '[36m',   // Cyan
            error: '[31m',  // Red
            warn: '[33m',   // Yellow
            debug: '[35m'   // Magenta
        };
        return colors[level] || '[37m'; // White
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    error(message, data = null) {
        this.log('error', message, data);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }
}

module.exports = new Logger();