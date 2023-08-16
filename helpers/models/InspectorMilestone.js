const { Sequelize } = require("sequelize");

const InspectorUserMilestoneModel = (db) => db.define('UserMilestone', {
    user_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: false, },
    achievement: { type: Sequelize.STRING, primaryKey: true, autoIncrement: false, },
    time: { type: Sequelize.DATE, primaryKey: true, autoIncrement: false, },
    count: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: false, },
}, {
    tableName: 'osu_users_achievement_history',
    timestamps: false
});
module.exports.InspectorUserMilestoneModel = InspectorUserMilestoneModel;