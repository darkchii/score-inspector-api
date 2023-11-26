const { Sequelize } = require("sequelize");

const InspectorBeatmapMaxScoreModel = (db) => db.define('BeatmapMaxScore', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    mods: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    max_score: { type: Sequelize.INTEGER, allowNull: false }
}, {
    tableName: 'beatmap_maxscore',
    timestamps: false
});
module.exports.InspectorBeatmapMaxScoreModel = InspectorBeatmapMaxScoreModel;