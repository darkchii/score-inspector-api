const { DataTypes } = require("@sequelize/core");

const InspectorHistoricalScoreRankModel = (db, mode) => db.define('HistoricalScoreRank', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    date: { type: DataTypes.DATE, allowNull: false, },
    osu_id: { type: DataTypes.INTEGER, allowNull: false, },
    username: { type: DataTypes.STRING, allowNull: false, },
    rank: { type: DataTypes.INTEGER, allowNull: false, },
    old_rank: { type: DataTypes.INTEGER, allowNull: false, },
    ranked_score: { type: DataTypes.INTEGER, allowNull: false, },
    old_ranked_score: { type: DataTypes.INTEGER, allowNull: false, },
}, {
    tableName: `score_rank_history_${mode}`,
    timestamps: false
});
module.exports.InspectorHistoricalScoreRankModel = InspectorHistoricalScoreRankModel;