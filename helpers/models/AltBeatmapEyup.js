const { Sequelize } = require("sequelize");

const AltBeatmapEyupModel = (db) => db.define('BeatmapEyup', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    difficultyrating: { type: Sequelize.FLOAT, allowNull: false, },
}, {
    tableName: 'beatmaps_eyup',
    timestamps: false
});
module.exports.AltBeatmapEyupModel = AltBeatmapEyupModel;