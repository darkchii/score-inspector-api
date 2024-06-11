const { Sequelize } = require("sequelize");
const moment = require("moment");

const AltScoreModel = (db) => db.define('Score', {
    user_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    score: { type: Sequelize.INTEGER, allowNull: false, },
    count300: { type: Sequelize.INTEGER, allowNull: false, },
    count100: { type: Sequelize.INTEGER, allowNull: false, },
    count50: { type: Sequelize.INTEGER, allowNull: false, },
    countmiss: { type: Sequelize.INTEGER, allowNull: false, },
    combo: { type: Sequelize.INTEGER, allowNull: false, },
    perfect: { type: Sequelize.INTEGER, allowNull: false, },
    enabled_mods: { type: Sequelize.INTEGER, allowNull: false },
    date_played: {
        type: Sequelize.DATE,
        allowNull: false,
        get() {
            const rawValue = this.getDataValue('date_played');
            return moment(rawValue).format('YYYY-MM-DDTHH:mm:ss[Z]');
        },
    },
    rank: { type: Sequelize.STRING, allowNull: false, },
    pp: { type: Sequelize.FLOAT, allowNull: false, },
    replay_available: { type: Sequelize.INTEGER, allowNull: false, },
    accuracy: { type: Sequelize.FLOAT, allowNull: false, }
}, {
    tableName: 'scores',
    timestamps: false,
});
module.exports.AltScoreModel = AltScoreModel;