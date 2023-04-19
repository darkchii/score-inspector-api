const { Sequelize } = require("sequelize");

const InspectorScoreStatModel = (db) => db.define('ScoreStat', {
    key: { type: Sequelize.STRING, primaryKey: true, },
    period: { type: Sequelize.STRING, allowNull: false, },
    value: { type: Sequelize.STRING, allowNull: false, },
}, {
    tableName: 'inspector_score_stats',
    timestamps: false
});
module.exports.InspectorScoreStatModel = InspectorScoreStatModel;