const { Sequelize } = require("sequelize");

const TournamentModel = (db) => db.define('Tournament', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    name: { type: Sequelize.STRING, allowNull: false, },
    short_name: { type: Sequelize.STRING, allowNull: false, },
    tournament_type: { type: Sequelize.STRING, allowNull: false, },
}, {
    tableName: 'tournaments',
    timestamps: false
});
module.exports.TournamentModel = TournamentModel;