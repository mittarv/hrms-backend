// /** ==================== ACTIVITY 1: USER AVERAGE ASSETS, LOGIN TIME, SESSIONS METRICS ==================== */
export interface ICumulativeUserStats {
    metric_date: Date;
    metric_name: string;
    metric_value: number; 
}

export interface IuserIdsWithSingleLogin {
    userId : number;
}


// /** ==================== ACTIVITY 2: ASSET & WILL METRICS ==================== */
export interface IUserAssetWillMetric {
    metric_date: Date; // Assuming it's a date string
    metric_type: string;
    metric_isDraft: number;
    metric_count: number;
}


// /** ==================== ACTIVITY 3: ASSET TYPE DISTRIBUTION ==================== */
export interface IUserAssetDetails {
    id: number;
    createdAt: Date;
    assetTypeId: number;
}
export interface IAssetType {
    id: number;
    assetCategoryId: number;
}
export interface IAssetStats {
    metric_date: string;
    asset_type_id: number;
    assets_created: number;
    createdAt: Date;
    updatedAt: Date;
}