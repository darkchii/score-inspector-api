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
}, {
    tableName: 'scoresmods',
    timestamps: false,
});
module.exports.AltScoreModsModel = AltScoreModsModel;