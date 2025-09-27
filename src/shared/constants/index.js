"use strict";
// Shared constants for both frontend and backend
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCRAPING = exports.DATABASE = exports.API_ENDPOINTS = exports.COLLECTION_SCHEDULE = exports.ALERT_TYPES = exports.BUILDINGS = void 0;
exports.BUILDINGS = {
    FAIRVIEW: {
        name: 'Fairview',
        url: 'https://www.onnislu.com/fairview'
    },
    BOREN: {
        name: 'Boren',
        url: 'https://www.onnislu.com/boren'
    }
};
exports.ALERT_TYPES = {
    PRICE_DROP: 'price_drop',
    LOWEST_PRICE: 'lowest_price'
};
exports.COLLECTION_SCHEDULE = {
    CRON_PATTERN: '0 9,21 * * *', // 9 AM and 9 PM daily
    TIMEZONE: 'America/Los_Angeles'
};
exports.API_ENDPOINTS = {
    FLOOR_PLANS: '/api/floorplans',
    PRICES: '/api/prices',
    ALERTS: '/api/alerts',
    EXPORT: '/api/export',
    STATUS: '/api/status'
};
exports.DATABASE = {
    DEFAULT_PATH: './data/onnislu.db',
    BACKUP_RETENTION_DAYS: 30
};
exports.SCRAPING = {
    USER_AGENT: 'Mozilla/5.0 (compatible; ONNISLU-Price-Tracker/1.0)',
    REQUEST_DELAY: 2000, // 2 seconds between requests
    TIMEOUT: 30000, // 30 seconds
    MAX_RETRIES: 3
};
