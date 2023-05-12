const { Sequelize } = require("sequelize");

const AltTopScoreModel = (db) => db.define('TopScore', {
    user_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    score: { type: Sequelize.INTEGER, allowNull: false, },
    pp: { type: Sequelize.FLOAT, allowNull: false, },
    pos: { type: Sequelize.INTEGER, allowNull: false, },
}, {
    tableName: 'scores_top',
    timestamps: false
});
module.exports.AltTopScoreModel = AltTopScoreModel;