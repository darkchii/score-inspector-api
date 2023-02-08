const { Sequelize } = require("sequelize");

const InspectorModdedStarsModel = (db) => db.define('ModdedStars', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    version: { type: Sequelize.STRING, allowNull: false, },
    mods: { type: Sequelize.SMALLINT, primaryKey: true, allowNull: false, },
    star_rating: { type: Sequelize.FLOAT, allowNull: true, },
    aim_diff: { type: Sequelize.FLOAT, allowNull: true, },
    speed_diff: { type: Sequelize.FLOAT, allowNull: true, },
    fl_diff: { type: Sequelize.FLOAT, allowNull: true, },
    slider_factor: { type: Sequelize.FLOAT, allowNull: true, },
    modded_od: { type: Sequelize.FLOAT, allowNull: true, },
    modded_ar: { type: Sequelize.FLOAT, allowNull: true, },
    modded_cs: { type: Sequelize.FLOAT, allowNull: true, },
    modded_hp: { type: Sequelize.FLOAT, allowNull: true, },
    speed_note_count: { type: Sequelize.INTEGER, allowNull: true, }
}, {
    tableName: 'modded_sr',
    timestamps: false
});
module.exports.InspectorModdedStarsModel = InspectorModdedStarsModel;