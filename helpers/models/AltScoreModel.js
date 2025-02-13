const { DataTypes } = require("@sequelize/core");
const moment = require("moment");

const AltScoreModel = (db) => db.define('Score', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    score: { type: DataTypes.INTEGER, allowNull: false, },
    count300: { type: DataTypes.INTEGER, allowNull: false, },
    count100: { type: DataTypes.INTEGER, allowNull: false, },
    count50: { type: DataTypes.INTEGER, allowNull: false, },
    countmiss: { type: DataTypes.INTEGER, allowNull: false, },
    combo: { type: DataTypes.INTEGER, allowNull: false, },
    perfect: { type: DataTypes.INTEGER, allowNull: false, },
    enabled_mods: { type: DataTypes.INTEGER, allowNull: false },
    date_played: {
        type: DataTypes.DATE, allowNull: false,
        get() {
            const rawValue = this.getDataValue('date_played');
            return moment(rawValue).format('YYYY-MM-DDTHH:mm:ss[Z]');
        },
    },
    rank: { type: DataTypes.STRING, allowNull: false, },
    pp: { type: DataTypes.FLOAT, allowNull: false, },
    replay_available: { type: DataTypes.INTEGER, allowNull: false, },
    accuracy: { type: DataTypes.FLOAT, allowNull: false, }
}, {
    tableName: 'scores',
    timestamps: false,
});
module.exports.AltScoreModel = AltScoreModel;