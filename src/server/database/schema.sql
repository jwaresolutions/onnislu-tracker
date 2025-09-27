-- ONNISLU Price Tracker Database Schema
-- SQLite database initialization script

-- Buildings table
CREATE TABLE IF NOT EXISTS buildings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Floor plans table
CREATE TABLE IF NOT EXISTS floor_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    bedrooms INTEGER NOT NULL,
    bathrooms REAL NOT NULL,
    has_den BOOLEAN DEFAULT FALSE,
    square_footage INTEGER,
    building_position TEXT, -- e.g., "North-facing", "Corner unit"
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    UNIQUE(building_id, name)
);

-- Price history table (stores only lowest daily price)
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    floor_plan_id INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    collection_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (floor_plan_id) REFERENCES floor_plans(id) ON DELETE CASCADE,
    UNIQUE(floor_plan_id, collection_date)
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    floor_plan_id INTEGER NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'lowest_price')),
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2) NOT NULL,
    percentage_change REAL,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (floor_plan_id) REFERENCES floor_plans(id) ON DELETE CASCADE
);

-- Settings table for application configuration
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_floor_plans_building_id ON floor_plans(building_id);
CREATE INDEX IF NOT EXISTS idx_price_history_floor_plan_id ON price_history(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(collection_date);
CREATE INDEX IF NOT EXISTS idx_alerts_floor_plan_id ON alerts(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_alerts_dismissed ON alerts(is_dismissed);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Insert default buildings
INSERT OR IGNORE INTO buildings (name, url) VALUES 
    ('Fairview', 'https://www.onnislu.com/fairview'),
    ('Boren', 'https://www.onnislu.com/boren');

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('alert_threshold_type', 'percentage'),
    ('alert_threshold_value', '5.0'),
    ('last_collection_time', ''),
    ('next_collection_time', '');