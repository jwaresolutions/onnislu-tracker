export interface Building {
    id: number;
    name: string;
    url: string;
    createdAt?: string;
}
export interface FloorPlan {
    id: number;
    buildingId: number;
    buildingName: string;
    name: string;
    bedrooms: number;
    bathrooms: number;
    hasDen: boolean;
    squareFootage: number;
    buildingPosition: string;
    imageUrl?: string;
    currentPrice?: number;
    isAvailable: boolean;
    lowestPrice?: number;
    lowestPriceDate?: string;
    createdAt?: string;
}
export interface PriceHistory {
    id: number;
    floorPlanId: number;
    price: number;
    isAvailable: boolean;
    collectionDate: string;
    createdAt?: string;
}
export interface Alert {
    id: number;
    floorPlanId: number;
    floorPlanName: string;
    buildingName: string;
    alertType: 'price_drop' | 'lowest_price';
    oldPrice: number;
    newPrice: number;
    percentageChange: number;
    isDismissed: boolean;
    createdAt: string;
}
export interface AlertSettings {
    thresholdType: 'dollar' | 'percentage';
    thresholdValue: number;
}
export interface SystemStatus {
    isHealthy: boolean;
    lastCollection?: string;
    nextCollection?: string;
    totalFloorPlans: number;
    totalPriceRecords: number;
    activeAlerts: number;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface FilterOptions {
    bedrooms?: number[];
    bathrooms?: number[];
    buildings?: string[];
    hasDen?: boolean;
    minPrice?: number;
    maxPrice?: number;
    minSquareFootage?: number;
    maxSquareFootage?: number;
    searchTerm?: string;
}
export interface ExportOptions {
    startDate?: string;
    endDate?: string;
    floorPlanIds?: number[];
    includeUnavailable?: boolean;
}
