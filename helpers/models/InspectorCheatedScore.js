const { Sequelize } = require("sequelize");

const InspectorCheatedScoreModel = (db) => db.define('BeatmapCheatedScore', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    user_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    score: { type: Sequelize.INTEGER, allowNull: false, },
    count300: { type: Sequelize.INTEGER, allowNull: false, },
    count100: { type: Sequelize.INTEGER, allowNull: false, },
    count50: { type: Sequelize.INTEGER, allowNull: false, },
    countmiss: { type: Sequelize.INTEGER, allowNull: false, },
    combo: { type: Sequelize.INTEGER, allowNull: false, },
    perfect: { type: Sequelize.INTEGER, allowNull: false, },
    enabled_mods: { type: Sequelize.INTEGER, allowNull: false, },
    date_played: { type: Sequelize.DATE, allowNull: false, },
    rank: { type: Sequelize.STRING, allowNull: false, },
    pp: { type: Sequelize.FLOAT, allowNull: false, },
    replay_available: { type: Sequelize.INTEGER, allowNull: false, },
    accuracy: { type: Sequelize.FLOAT, allowNull: false, },
    is_deleted: { type: Sequelize.BOOLEAN, allowNull: false, },
    date_deleted: { type: Sequelize.DATE, allowNull: true, },
    reason: { type: Sequelize.STRING, allowNull: false, },
}, {
    tableName: 'cheated_scores',
    timestamps: false
});
module.exports.InspectorCheatedScoreModel = InspectorCheatedScoreModel;