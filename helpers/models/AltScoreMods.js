const { DataTypes } = require("@sequelize/core");
const moment = require("moment");

const AltScoreModsModel = (db) => db.define('ScoreMods', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    //pgsql jsonb
    mods: { type: DataTypes.JSONB, allowNull: false, },
    date_played: {
        type: DataTypes.DATE,
        allowNull: false,
        get() {
            const rawValue = this.getDataValue('date_played');
            return moment(rawValue).format('YYYY-MM-DDTHH:mm:ss[Z]');
        },
    },
    star_rating: { type: DataTypes.FLOAT },
    aim_difficulty: { type: DataTypes.FLOAT },
    speed_difficulty: { type: DataTypes.FLOAT },
    speed_note_count: { type: DataTypes.FLOAT },
    flashlight_difficulty: { type: DataTypes.FLOAT },
    aim_difficult_strain_count: { type: DataTypes.FLOAT },
    speed_difficult_strain_count: { type: DataTypes.FLOAT },
    approach_rate: { type: DataTypes.FLOAT },
    overall_difficulty: { type: DataTypes.FLOAT },
    drain_rate: { type: DataTypes.FLOAT },
    slider_factor: { type: DataTypes.FLOAT },
    max_combo: { type: DataTypes.INTEGER },
    date_attributes: {
        type: DataTypes.DATE, allowNull: true, get() {
            const rawValue = this.getDataValue('date_attributes');
            return moment(rawValue).format('YYYY-MM-DDTHH:mm:ss[Z]');
        },
    },
    statistics: { type: DataTypes.JSONB },
    maximum_statistics: { type: DataTypes.JSONB },
}, {
    tableName: 'scoresmods',
    timestamps: false,
});
module.exports.AltScoreModsModel = AltScoreModsModel;