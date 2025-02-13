const { DataTypes } = require("@sequelize/core");

const AltModdedStarsModel = (db) => db.define('ModdedStars', {
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    approved_date: { type: DataTypes.DATE, allowNull: false, },
    mods_enum: { type: DataTypes.SMALLINT, primaryKey: true, allowNull: false, },
    star_rating: { type: DataTypes.FLOAT, allowNull: false, },
    aim_diff: { type: DataTypes.FLOAT, allowNull: false, },
    speed_diff: { type: DataTypes.FLOAT, allowNull: false, },
    fl_diff: { type: DataTypes.FLOAT, allowNull: false, },
    slider_factor: { type: DataTypes.FLOAT, allowNull: false, },
    modded_od: { type: DataTypes.FLOAT, allowNull: false, },
    modded_ar: { type: DataTypes.FLOAT, allowNull: false, },
    modded_cs: { type: DataTypes.FLOAT, allowNull: false, },
    modded_hp: { type: DataTypes.FLOAT, allowNull: false, },
    speed_note_count: { type: DataTypes.INTEGER, allowNull: false, }
}, {
    tableName: 'moddedsr',
    timestamps: false
});
module.exports.AltModdedStarsModel = AltModdedStarsModel;