const { DataTypes } = require("@sequelize/core");

const TournamentModel = (db) => db.define('Tournament', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    name: { type: DataTypes.STRING, allowNull: false, },
    short_name: { type: DataTypes.STRING, allowNull: false, },
    tournament_type: { type: DataTypes.STRING, allowNull: false, },
}, {
    tableName: 'tournaments',
    timestamps: false
});
module.exports.TournamentModel = TournamentModel;