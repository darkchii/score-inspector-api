const { DataTypes } = require("@sequelize/core");

const AltUserAchievementModel = (db) => db.define('UserAchievements', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    achievement_id: { type: DataTypes.INTEGER, primaryKey: true },
    achieved_at: { type: DataTypes.DATE },
}, {
    tableName: 'user_achievements',
    timestamps: false,
});
module.exports.AltUserAchievementModel = AltUserAchievementModel;