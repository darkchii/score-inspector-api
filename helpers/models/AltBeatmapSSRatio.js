const { DataTypes } = require("@sequelize/core");

const AltBeatmapSSRatioModel = (db) => db.define('BeatmapSSRatio', {
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    ratio: { type: DataTypes.FLOAT, allowNull: false, },
}, {
    tableName: 'beatmap_ss_ratio',
    timestamps: false
});
module.exports.AltBeatmapSSRatioModel = AltBeatmapSSRatioModel;