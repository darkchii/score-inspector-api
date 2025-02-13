const { DataTypes } = require("@sequelize/core");

const InspectorClanRankingModel = (db) => db.define('InspectorClanRanking', {
    id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, autoIncrement: true },
    date: { type: DataTypes.TEXT, allowNull: false, }, // YYYY-MM
    data: { type: DataTypes.TEXT, allowNull: false, },
}, {
    tableName: 'inspector_clan_ranking',
    timestamps: false
});
module.exports.InspectorClanRankingModel = InspectorClanRankingModel;