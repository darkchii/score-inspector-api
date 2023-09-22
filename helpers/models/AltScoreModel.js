const { Sequelize } = require("sequelize");

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
    enabled_mods: { type: Sequelize.INTEGER, allowNull: false, },
    date_played: { type: Sequelize.DATE, allowNull: false, },
    rank: { type: Sequelize.STRING, allowNull: false, },
    pp: { type: Sequelize.FLOAT, allowNull: false, },
    replay_available: { type: Sequelize.INTEGER, allowNull: false, },
    // is_hd: { type: Sequelize.BOOLEAN, allowNull: false, },
    // is_hr: { type: Sequelize.BOOLEAN, allowNull: false, },
    // is_dt: { type: Sequelize.BOOLEAN, allowNull: false, },
    // is_fl: { type: Sequelize.BOOLEAN, allowNull: false, },
    // is_ht: { type: Sequelize.BOOLEAN, allowNull: false, },
    // is_ez: { type: Sequelize.BOOLEAN, allowNull: false, },
    // is_nf: { type: Sequelize.BOOLEAN, allowNull: false, },
    // is_nc: { type: Sequelize.BOOLEAN, allowNull: false, },
    // is_td: { type: Sequelize.BOOLEAN, allowNull: false, },
    // is_so: { type: Sequelize.BOOLEAN, allowNull: false, },
    // is_sd: { type: Sequelize.BOOLEAN, allowNull: false, },
    // is_pf: { type: Sequelize.BOOLEAN, allowNull: false, },
    accuracy: { type: Sequelize.FLOAT, allowNull: false, }
}, {
    tableName: 'scores',
    timestamps: false
});
module.exports.AltScoreModel = AltScoreModel;