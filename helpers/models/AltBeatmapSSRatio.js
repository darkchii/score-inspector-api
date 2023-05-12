const { Sequelize } = require("sequelize");

const AltBeatmapSSRatioModel = (db) => db.define('BeatmapSSRatio', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    ratio: { type: Sequelize.FLOAT, allowNull: false, },
}, {
    tableName: 'beatmap_ss_ratio',
    timestamps: false
});
module.exports.AltBeatmapSSRatioModel = AltBeatmapSSRatioModel;