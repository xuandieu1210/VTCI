// src/utils/excelHelper.js
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class ExcelHelper {
    static readFile(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            return XLSX.utils.sheet_to_json(worksheet);
        } catch (error) {
            throw new Error('Khong the doc file Excel: ' + error.message);
        }
    }

    static writeFile(data, headers, fileName) {
        try {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            
            const dir = './exports';
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const filePath = path.join(dir, fileName);
            XLSX.writeFile(wb, filePath);
            return filePath;
        } catch (error) {
            throw new Error('Khong the ghi file Excel: ' + error.message);
        }
    }

    static createTemplate(headers, fileName = 'template.xlsx') {
        try {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet([headers]);
            XLSX.utils.book_append_sheet(wb, ws, 'Template');
            
            const dir = './exports';
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const filePath = path.join(dir, fileName);
            XLSX.writeFile(wb, filePath);
            return filePath;
        } catch (error) {
            throw new Error('Khong the tao template: ' + error.message);
        }
    }

    static validateColumns(data, requiredColumns) {
        if (!data || data.length === 0) {
            return { valid: false, message: 'File rong, khong co du lieu' };
        }

        const firstRow = data[0];
        const columns = Object.keys(firstRow);
        const missing = requiredColumns.filter(col => !columns.includes(col));

        if (missing.length > 0) {
            return {
                valid: false,
                message: 'Thieu cac cot: ' + missing.join(', ')
            };
        }

        return { valid: true };
    }
}

module.exports = ExcelHelper;