export declare const BUILDINGS: {
    readonly FAIRVIEW: {
        readonly name: "Fairview";
        readonly url: "https://www.onnislu.com/fairview";
    };
    readonly BOREN: {
        readonly name: "Boren";
        readonly url: "https://www.onnislu.com/boren";
    };
};
export declare const ALERT_TYPES: {
    readonly PRICE_DROP: "price_drop";
    readonly LOWEST_PRICE: "lowest_price";
};
export declare const COLLECTION_SCHEDULE: {
    readonly CRON_PATTERN: "0 9,21 * * *";
    readonly TIMEZONE: "America/Los_Angeles";
};
export declare const API_ENDPOINTS: {
    readonly FLOOR_PLANS: "/api/floorplans";
    readonly PRICES: "/api/prices";
    readonly ALERTS: "/api/alerts";
    readonly EXPORT: "/api/export";
    readonly STATUS: "/api/status";
};
export declare const DATABASE: {
    readonly DEFAULT_PATH: "./data/onnislu.db";
    readonly BACKUP_RETENTION_DAYS: 30;
};
export declare const SCRAPING: {
    readonly USER_AGENT: "Mozilla/5.0 (compatible; ONNISLU-Price-Tracker/1.0)";
    readonly REQUEST_DELAY: 2000;
    readonly TIMEOUT: 30000;
    readonly MAX_RETRIES: 3;
};
