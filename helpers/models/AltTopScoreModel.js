const { DataTypes } = require("@sequelize/core");

const AltTopScoreModel = (db) => db.define('TopScore', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    score: { type: DataTypes.INTEGER, allowNull: false, },
    pp: { type: DataTypes.FLOAT, allowNull: false, },
    pos: { type: DataTypes.INTEGER, allowNull: false, },
}, {
    tableName: 'scores_top',
    timestamps: false
});
module.exports.AltTopScoreModel = AltTopScoreModel;