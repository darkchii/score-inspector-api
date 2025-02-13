const { DataTypes } = require("@sequelize/core");

const InspectorUserMilestoneModel = (db) => db.define('UserMilestone', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false, },
    achievement: { type: DataTypes.STRING, primaryKey: true, autoIncrement: false, },
    time: { type: DataTypes.DATE, primaryKey: true, autoIncrement: false, },
    count: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false, },
}, {
    tableName: 'osu_users_achievement_history',
    timestamps: false
});
module.exports.InspectorUserMilestoneModel = InspectorUserMilestoneModel;