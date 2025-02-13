const { DataTypes } = require("@sequelize/core");

const AltBeatmapEyupModel = (db) => db.define('BeatmapEyup', {
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    difficultyrating: { type: DataTypes.FLOAT, allowNull: false, },
}, {
    tableName: 'beatmaps_eyup',
    timestamps: false
});
module.exports.AltBeatmapEyupModel = AltBeatmapEyupModel;