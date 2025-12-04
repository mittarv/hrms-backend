import { UserAssetsWillsMetricsClass, UserAssetCategoryStatsClass, CumulativeUserStatsClass } from "../classes/analyticsClasses";

export const analyticsPipeline = async () => {
    console.log(`[${new Date().toISOString()}] Starting Analytics Metrics pipeline...`);

    try {
        /** ==================== ACTIVITY 1: CUMULATIVE USER & ASSET METRICS ==================== */
        try {
            console.log(`[${new Date().toISOString()}] Starting CUMULATIVE USER & ASSET METRICS...`);
            const cumulativeStats = new CumulativeUserStatsClass();
            await cumulativeStats.fetchAverageAssetsPerUser();
            await cumulativeStats.registeredButNeverLoggedIn();
            await cumulativeStats.averageDaysSinceLastLogin();
            await cumulativeStats.usersWithExactlyTwoLogins();
            cumulativeStats.insertData();
            console.log(`[${new Date().toISOString()}] CUMULATIVE USER & ASSET METRICS completed.`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error in CUMULATIVE USER & ASSET METRICS:`, error);
        }

        /** ==================== ACTIVITY 2: ASSET & WILL METRICS ==================== */
        try {
            console.log(`[${new Date().toISOString()}] Starting ASSET & WILL METRICS...`);
            const metricsCollector = new UserAssetsWillsMetricsClass();
            await metricsCollector.truncateTable();
            await metricsCollector.fetchMetrics();
            console.log(`[${new Date().toISOString()}] ASSET & WILL METRICS completed.`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error in ASSET & WILL METRICS:`, error);
        }

        /** ==================== ACTIVITY 3: ASSET TYPE DISTRIBUTION ==================== */
        try {
            console.log(`[${new Date().toISOString()}] Starting ASSET TYPE DISTRIBUTION...`);
            const assetStatsManager = new UserAssetCategoryStatsClass();
            await assetStatsManager.truncateTable();
            await assetStatsManager.fetchUserAssets();
            await assetStatsManager.fetchAssetTypes();
            assetStatsManager.processAssets();
            await assetStatsManager.saveAssetStats();
            console.log(`[${new Date().toISOString()}] ASSET TYPE DISTRIBUTION completed.`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error in ASSET TYPE DISTRIBUTION:`, error);
        }


        console.log(`[${new Date().toISOString()}] Analytics pipeline execution completed...`);

    } catch (error) { 
        // Will this even get executed ? if all inner func are in try catch. For extra loggin just wrapping once more
        console.error(`[${new Date().toISOString()}] Error in Analytics pipeline:`, error);
    }
};
