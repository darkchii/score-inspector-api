const { DataTypes } = require("@sequelize/core");

const InspectorBackgroundSongSourceModel = (db) => db.define('BeatmapSongSource', {
    beatmapset_id: { type: DataTypes.INTEGER, primaryKey: true },
    source_type: { type: DataTypes.STRING, primaryKey: true },
    source_url: { type: DataTypes.STRING, primaryKey: true },
}, {
    tableName: 'inspector_beatmap_song',
    timestamps: false,
});
module.exports.InspectorBackgroundSongSourceModel = InspectorBackgroundSongSourceModel;