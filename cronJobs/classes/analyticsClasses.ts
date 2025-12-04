import { IUserAssetDetails, IAssetType, IAssetStats, IUserAssetWillMetric, ICumulativeUserStats, IuserIdsWithSingleLogin } from "../Interfaces/analyticsInterfaces";
import { db, dbOutput, sequelize } from "../../models/index";
import { Sequelize, where } from "sequelize";

const cumulativeStats = dbOutput.cumulativeStats;
const AssetStats = dbOutput.assetStats;
const UserStats = dbOutput.userStats;
const UserAssetDetails = db.userAssetDetails;
const AllWills = db.allwills;
const Users = db.users;
const UserLoginTracks = db.userLoginTrack;
const AssetTypes = db.assetType;

class CumulativeUserStatsClass {
    private cumulativeStats: ICumulativeUserStats[] = [];

    async fetchAverageAssetsPerUser() {
        const allAssetsCount = await UserAssetDetails.count();
        const distinctUserIdsInAssetTable = await UserAssetDetails.count({
            distinct: true,
            col: 'userId'  // count of theedistinct user IDs
        });

        if (distinctUserIdsInAssetTable === 0) {
            return 0;
        }

        this.addMetric({
            metric_date: new Date(),
            metric_name: "Average Assets Per User",
            metric_value: allAssetsCount / distinctUserIdsInAssetTable
        })
    }

    async registeredButNeverLoggedIn() {
        const allUserIdsWithSingleLoginTrack = await UserLoginTracks.findAll({
            attributes: ['userId'],
            group: ['userId'],
            having: Sequelize.literal('COUNT(userId) = 1'),
            raw: true
        }) as IuserIdsWithSingleLogin[];

        const countOfUsersWithSingleLogin = await Users.count({
            where: {
                id: allUserIdsWithSingleLoginTrack.map(singleLogin => singleLogin.userId)
            }
        })

        this.addMetric({
            metric_date: new Date(),
            metric_name: "Registered Users but never logged in",
            metric_value: countOfUsersWithSingleLogin
        })
    }

    async averageDaysSinceLastLogin() {
        const usersLastLogin = await UserLoginTracks.findAll({
            attributes: [
                'userId',
                [Sequelize.fn('MAX', Sequelize.col('lastLogin')), 'lastLogin']
            ],
            group: ['userId']
        });

        if (!usersLastLogin.length) return 0; // No users, return 0

        const totalDays = usersLastLogin.reduce((sum, record: any) => {
            const lastLogin = new Date(record.getDataValue('lastLogin'));
            const daysSinceLastLogin = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
            return sum + daysSinceLastLogin;
        }, 0);


        this.addMetric({
            metric_date: new Date(),
            metric_name: "Average Days Since Last Login",
            metric_value: totalDays / usersLastLogin.length
        })
    }

    async usersWithExactlyTwoLogins() {
        const usersWithTwoLogins = await UserLoginTracks.findAll({
            attributes: ['userId'],
            group: ['userId'],
            having: Sequelize.literal('COUNT(userId) = 2')
        });
        this.addMetric({
            metric_date: new Date(),
            metric_name: "Users with Exactly Two Logins",
            metric_value: usersWithTwoLogins.length
        })
    }


    private metricValidator(metric: ICumulativeUserStats) {
        if (metric.metric_value < 0) {
            return;
        }
        if (!metric.metric_name || !metric.metric_date) {
            return;
        }
    }

    private addMetric(metric: ICumulativeUserStats) {
        this.metricValidator(metric);
        this.cumulativeStats.push(metric);
    }

    getAllMetric(): ICumulativeUserStats[] {
        return this.cumulativeStats;
    }

    async insertData() {
       await cumulativeStats.bulkCreate(this.getAllMetric());
       this.cumulativeStats = []; 
    }
}


// /** ==================== ACTIVITY 2: ASSET & WILL METRICS ==================== */


class UserAssetsWillsMetricsClass {
    private metrics: IUserAssetWillMetric[] = []; // Store metrics here

    async fetchMetrics() {
        await Promise.all([
            this.processWills(false),
            this.processWills(true),
            this.processAssets(false),
            this.processAssets(true),
            this.processDeletedWillsCount(),
            this.processNewUsers()
        ]);

        await UserStats.bulkCreate(this.getAllMetrics());
        this.metrics = []; 

    }

    async processWills(isDeleted: boolean) {
        const wills = await AllWills.findAll({
            where: { isDeleted },
            attributes: [
                [Sequelize.literal("DATE(createdAt)"), "metric_date"],
                "type",
                "draft",
                [Sequelize.literal("COUNT(DISTINCT id)"), "metric_count"]
            ],
            group: [Sequelize.literal("DATE(createdAt)"), "type", "draft"]
        });

        wills.forEach(will => {
            this.addMetric({
                metric_date: will.getDataValue("metric_date"),
                metric_type: isDeleted ? `deleted ${will.getDataValue("type")}` : will.getDataValue("type"),
                metric_isDraft: will.getDataValue("draft") ? 1 : 0,
                metric_count: will.getDataValue("metric_count")
            });
        });
    }

    async processAssets(isDeleted: boolean) {
        const assets = await UserAssetDetails.findAll({
            where: { isDeleted },
            attributes: [
                [Sequelize.literal("DATE(createdAt)"), "metric_date"],
                [Sequelize.literal("COUNT(DISTINCT id)"), "metric_count"]
            ],
            group: [Sequelize.literal("DATE(createdAt)")]
        });

        assets.forEach(asset => {
            this.addMetric({
                metric_date: asset.getDataValue("metric_date"),
                metric_type: isDeleted ? "Deleted assets count" : "assets",
                metric_isDraft: 0,
                metric_count: asset.getDataValue("metric_count")
            });
        });
    }

    async processDeletedWillsCount() {
        const deletedWills = await AllWills.findAll({
            where: { isDeleted: true },
            attributes: [
                [Sequelize.literal("DATE(createdAt)"), "metric_date"],
                "draft",
                [Sequelize.literal("COUNT(DISTINCT id)"), "metric_count"]
            ],
            group: [Sequelize.literal("DATE(createdAt)"), "draft"]
        });

        deletedWills.forEach(will => {
            this.addMetric({
                metric_date: will.getDataValue("metric_date"),
                metric_type: "Deleted ew count",
                metric_isDraft: will.getDataValue("draft") ? 1 : 0,
                metric_count: will.getDataValue("metric_count")
            });
        });
    }

    async processNewUsers() {
        const newUsers = await Users.findAll({
            attributes: [
                [Sequelize.literal("DATE(createdAt)"), "metric_date"],
                [Sequelize.literal("COUNT(DISTINCT id)"), "metric_count"]
            ],
            group: [Sequelize.literal("DATE(createdAt)")]
        });

        newUsers.forEach(user => {
            this.addMetric({
                metric_date: user.getDataValue("metric_date"),
                metric_type: "new users",
                metric_isDraft: 0,
                metric_count: user.getDataValue("metric_count")
            });
        });
    }

    private metricValidator(metric: IUserAssetWillMetric) {
        if (!metric.metric_date) {
            return;
        }
    }

    // private to ensure no one m
    private addMetric(metric: IUserAssetWillMetric) {
        this.metricValidator(metric);
        this.metrics.push(metric);
    }

    getAllMetrics(): IUserAssetWillMetric[] {
        return this.metrics;
    }

    async truncateTable(){
        await UserStats.truncate({ cascade: true, restartIdentity: true });
    }
}

// /** ==================== ACTIVITY 3: ASSET TYPE DISTRIBUTION ==================== */

class UserAssetCategoryStatsClass {
    private userAssets: IUserAssetDetails[] = [];
    private assetTypes: IAssetType[] = [];
    private assetTypeMap: Record<number, number> = {};
    private userAssetCategoryStats: Record<string, IAssetStats> = {};

    async fetchUserAssets() {
        this.userAssets = await UserAssetDetails.findAll({
            attributes: ['id', 'createdAt', 'assetTypeId'],
            raw: true,
        });
    }

    async fetchAssetTypes() {
        this.assetTypes = await AssetTypes.findAll({
            attributes: ['id', 'assetCategoryId'],
            raw: true,
        });

        for (const asset of this.assetTypes) {
            this.assetTypeMap[asset.id] = asset.assetCategoryId;
        }
    }

    processAssets() {
        for (const asset of this.userAssets) {
            const metric_date = asset.createdAt.toISOString().split('T')[0];
            const asset_type_id = this.assetTypeMap[asset.assetTypeId];

            if (asset_type_id !== null) {
                const key = `${metric_date}_${asset_type_id}`; /// unique key for a combination of the metric
                if (!this.userAssetCategoryStats[key]) {
                    this.userAssetCategoryStats[key] = {
                        metric_date,
                        asset_type_id,
                        assets_created: 0, // initilize zero as not else so this.stats[key].assets_created++; will take care of increment
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    };
                }
                this.userAssetCategoryStats[key].assets_created++;
            }
        }
    }

    getAssetStats(): IAssetStats[] {
        return Object.values(this.userAssetCategoryStats);
    }

    async saveAssetStats() {
        const statsArray = Object.values(this.userAssetCategoryStats);

        if (statsArray.length === 0) {
            console.log('No new asset stats to insert.');
            return;
        }

        try {
            await AssetStats.bulkCreate(statsArray);
            this.userAssetCategoryStats = {};
            console.log('Asset stats inserted/updated successfully!');
        } catch (error) {
            this.userAssetCategoryStats = {};
            console.error('Error inserting asset stats:', error);
        }
    }
    
    async truncateTable(){
        await AssetStats.truncate({ cascade: true, restartIdentity: true });
    }
}


export { UserAssetsWillsMetricsClass, UserAssetCategoryStatsClass, CumulativeUserStatsClass }