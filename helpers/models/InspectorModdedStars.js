const { Sequelize } = require("sequelize");

const InspectorModdedStarsModel = (db, version) => db.define('ModdedStars', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    data: { type: Sequelize.JSON },
}, {
    tableName: `modded_sr_v2_${version}`,
    timestamps: false
});
module.exports.InspectorModdedStarsModel = InspectorModdedStarsModel;