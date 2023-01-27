const { Sequelize } = require("sequelize");

const AltUserAchievementModel = (db) => db.define('UserAchievements', {
    user_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    achievement_id: { type: Sequelize.INTEGER, primaryKey: true },
    achieved_at: { type: Sequelize.DATE },
}, {
    tableName: 'user_achievements',
    timestamps: false,
});
module.exports.AltUserAchievementModel = AltUserAchievementModel;