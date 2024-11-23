const { Sequelize } = require("sequelize");
const moment = require("moment");

const AltScoreModsModel = (db) => db.define('ScoreMods', {
    user_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    //pgsql jsonb
    mods: { type: Sequelize.JSONB, allowNull: false, },
    date_played: {
        type: Sequelize.DATE,
        allowNull: false,
        get() {
            const rawValue = this.getDataValue('date_played');
            return moment(rawValue).format('YYYY-MM-DDTHH:mm:ss[Z]');
        },
    },
    star_rating: { type: Sequelize.FLOAT },
    aim_difficulty: { type: Sequelize.FLOAT },
    speed_difficulty: { type: Sequelize.FLOAT },
    speed_note_count: { type: Sequelize.FLOAT },
    flashlight_difficulty: { type: Sequelize.FLOAT },
    aim_difficult_strain_count: { type: Sequelize.FLOAT },
    speed_difficult_strain_count: { type: Sequelize.FLOAT },
    approach_rate: { type: Sequelize.FLOAT },
    overall_difficulty: { type: Sequelize.FLOAT },
    drain_rate: { type: Sequelize.FLOAT },
    slider_factor: { type: Sequelize.FLOAT },
    max_combo: { type: Sequelize.INTEGER },
    date_attributes: { type: Sequelize.DATE },
}, {
    tableName: 'scoresmods',
    timestamps: false,
});
module.exports.AltScoreModsModel = AltScoreModsModel;