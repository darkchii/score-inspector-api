const { DataTypes } = require("@sequelize/core");

const AltBeatmapPackModel = (db) => db.define('BeatmapPack', {
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    pack_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
}, {
    tableName: 'beatmap_packs',
    timestamps: false
});
module.exports.AltBeatmapPackModel = AltBeatmapPackModel;