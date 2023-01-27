const { Sequelize } = require("sequelize");

const AltBeatmapPackModel = (db) => db.define('BeatmapPack', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    pack_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
}, {
    tableName: 'beatmap_packs',
    timestamps: false
});
module.exports.AltBeatmapPackModel = AltBeatmapPackModel;