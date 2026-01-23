import { DataTypes, Model, Sequelize } from 'sequelize';
import { hrmsNotificationAttributes } from '../../../interfaces/hrmsTool/interface/hrmsInterface';
import { hrmsNotificationTypes } from '../../../interfaces/hrmsTool/enum/hrmsEnum';


export class hrmsNotificationLogs extends Model<
    hrmsNotificationAttributes
> implements hrmsNotificationAttributes {
    declare notificationId: string;
    declare message: string;
    declare notificationType: hrmsNotificationTypes;
    declare recipient_employee_id?: string;
    declare sender_employee_id: string;
    declare read_at?: Date;
    declare notification_effective_date: Date;
    declare notification_expiry_date?: Date;
    declare priority: number;
    declare is_deleted: boolean;
    declare createdAt?: Date;
    declare updatedAt?: Date;
}

export const initHrmsNotificationLogs = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
    hrmsNotificationLogs.init(
        {
            notificationId: {
                type: dataTypes.STRING,
                primaryKey: true,
            },
            message: {
                type: dataTypes.STRING,
                allowNull: false,
            },
            notificationType: {
                type: dataTypes.ENUM,
                values: Object.values(hrmsNotificationTypes),
                allowNull: false,
                validate: {
                    isIn: {
                        args: [Object.values(hrmsNotificationTypes)],
                        msg: 'Notification type must be my_updates or organization_updates',
                    },
                }
            },
            recipient_employee_id: {
                type: dataTypes.STRING,
                allowNull: true,
            },
            sender_employee_id: {
                type: dataTypes.STRING,
                allowNull: false,
            },
            read_at: {
                type: dataTypes.DATE,
                allowNull: true,
            },
            notification_effective_date: {
                type: dataTypes.DATE,
                allowNull: false,
            },
            notification_expiry_date: {
                type: dataTypes.DATE,
                allowNull: true,
            },
            priority: {
                type: dataTypes.INTEGER,
                allowNull: false,
                defaultValue: 100,
            },
            is_deleted: {
                type: dataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
        },
        {
            sequelize,
            modelName: 'hrmsNotificationLogs',
            tableName: 'hrmsNotificationLogs',
            timestamps: true,
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
        }
    );
    return hrmsNotificationLogs;
};
