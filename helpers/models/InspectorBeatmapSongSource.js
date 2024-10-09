const { Sequelize } = require("sequelize");

const InspectorBackgroundSongSourceModel = (db) => db.define('BeatmapSongSource', {
    beatmapset_id: { type: Sequelize.INTEGER, primaryKey: true },
    source_type: { type: Sequelize.STRING, primaryKey: true },
    source_url: { type: Sequelize.STRING, primaryKey: true },
}, {
    tableName: 'inspector_beatmap_song',
    timestamps: false,
});
module.exports.InspectorBackgroundSongSourceModel = InspectorBackgroundSongSourceModel;