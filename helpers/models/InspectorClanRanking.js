const { Sequelize } = require("sequelize");

const InspectorClanRankingModel = (db) => db.define('InspectorClanRanking', {
    id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, autoIncrement: true },
    date: { type: Sequelize.TEXT, allowNull: false, }, // YYYY-MM
    data: { type: Sequelize.TEXT, allowNull: false, },
}, {
    tableName: 'inspector_clan_ranking',
    timestamps: false
});
module.exports.InspectorClanRankingModel = InspectorClanRankingModel;