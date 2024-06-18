const { Sequelize } = require("sequelize");

const InspectorHistoricalScoreRankModel = (db, mode) => db.define('HistoricalScoreRank', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    date: { type: Sequelize.DATE, allowNull: false, },
    osu_id: { type: Sequelize.INTEGER, allowNull: false, },
    username: { type: Sequelize.STRING, allowNull: false, },
    rank: { type: Sequelize.INTEGER, allowNull: false, },
    old_rank: { type: Sequelize.INTEGER, allowNull: false, },
    ranked_score: { type: Sequelize.INTEGER, allowNull: false, },
    old_ranked_score: { type: Sequelize.INTEGER, allowNull: false, },
}, {
    tableName: `score_rank_history_${mode}`,
    timestamps: false
});
module.exports.InspectorHistoricalScoreRankModel = InspectorHistoricalScoreRankModel;