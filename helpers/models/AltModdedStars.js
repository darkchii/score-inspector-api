const { Sequelize } = require("sequelize");

const AltModdedStarsModel = (db) => db.define('ModdedStars', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    approved_date: { type: Sequelize.DATE, allowNull: false, },
    mods_enum: { type: Sequelize.SMALLINT, primaryKey: true, allowNull: false, },
    star_rating: { type: Sequelize.FLOAT, allowNull: false, },
    aim_diff: { type: Sequelize.FLOAT, allowNull: false, },
    speed_diff: { type: Sequelize.FLOAT, allowNull: false, },
    fl_diff: { type: Sequelize.FLOAT, allowNull: false, },
    slider_factor: { type: Sequelize.FLOAT, allowNull: false, },
    modded_od: { type: Sequelize.FLOAT, allowNull: false, },
    modded_ar: { type: Sequelize.FLOAT, allowNull: false, },
    modded_cs: { type: Sequelize.FLOAT, allowNull: false, },
    modded_hp: { type: Sequelize.FLOAT, allowNull: false, },
    speed_note_count: { type: Sequelize.INTEGER, allowNull: false, }
}, {
    tableName: 'moddedsr',
    timestamps: false
});
module.exports.AltModdedStarsModel = AltModdedStarsModel;