// Database model interfaces for ONNISLU Price Tracker

export interface Building {
  id: number;
  name: string;
  url: string;
  created_at?: string;
}

export interface FloorPlan {
  id: number;
  building_id: number;
  building_name?: string; // Populated via JOIN
  name: string;
  bedrooms: number;
  bathrooms: number;
  has_den: boolean;
  square_footage?: number;
  building_position?: string;
  image_url?: string;
  created_at?: string;
  // Computed fields from price history
  current_price?: number;
  is_available?: boolean;
  lowest_price?: number;
  lowest_price_date?: string;
}

export interface PriceHistory {
  id: number;
  floor_plan_id: number;
  price: number;
  is_available: boolean;
  collection_date: string; // ISO date string (YYYY-MM-DD)
  created_at?: string;
}

export interface Alert {
  id: number;
  floor_plan_id: number;
  floor_plan_name?: string; // Populated via JOIN
  building_name?: string; // Populated via JOIN
  alert_type: 'price_drop' | 'lowest_price';
  old_price?: number;
  new_price: number;
  percentage_change?: number;
  is_dismissed: boolean;
  created_at?: string;
}

export interface AlertSettings {
  threshold_type: 'dollar' | 'percentage';
  threshold_value: number;
}

export interface Settings {
  id: number;
  key: string;
  value: string;
  updated_at?: string;
}

// Input types for database operations
export interface CreateBuildingInput {
  name: string;
  url: string;
}

export interface CreateFloorPlanInput {
  building_id: number;
  name: string;
  bedrooms: number;
  bathrooms: number;
  has_den?: boolean;
  square_footage?: number;
  building_position?: string;
  image_url?: string;
}

export interface CreatePriceHistoryInput {
  floor_plan_id: number;
  price: number;
  is_available: boolean;
  collection_date: string;
}

export interface CreateAlertInput {
  floor_plan_id: number;
  alert_type: 'price_drop' | 'lowest_price';
  old_price?: number;
  new_price: number;
  percentage_change?: number;
}

export interface UpdateFloorPlanInput {
  name?: string;
  bedrooms?: number;
  bathrooms?: number;
  has_den?: boolean;
  square_footage?: number;
  building_position?: string;
  image_url?: string;
}

export interface UpdateSettingsInput {
  key: string;
  value: string;
}

// Database operation result types
export interface DatabaseResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface TransactionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Query parameter types
export interface PriceHistoryQuery {
  floor_plan_id?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface FloorPlanQuery {
  building_id?: number;
  bedrooms?: number;
  bathrooms?: number;
  has_den?: boolean;
  available_only?: boolean;
}