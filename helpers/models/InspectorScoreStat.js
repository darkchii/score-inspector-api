const { DataTypes } = require("@sequelize/core");

const InspectorScoreStatModel = (db) => db.define('ScoreStat', {
    key: { type: DataTypes.STRING, primaryKey: true, },
    period: { type: DataTypes.STRING, allowNull: false, },
    value: { type: DataTypes.STRING, allowNull: false, },
}, {
    tableName: 'inspector_score_stats',
    timestamps: false
});
module.exports.InspectorScoreStatModel = InspectorScoreStatModel;