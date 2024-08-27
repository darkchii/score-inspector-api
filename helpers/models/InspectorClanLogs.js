const { Sequelize } = require("sequelize");

const InspectorClanLogsModel = (db) => db.define('InspectorClanLogs', {
    id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, autoIncrement: true },
    clan_id: { type: Sequelize.INTEGER, allowNull: false, },
    created_at: { type: Sequelize.DATE, allowNull: false, },
    data: { type: Sequelize.STRING, allowNull: false, },
}, {
    tableName: 'inspector_clan_logs',
    timestamps: false
});
module.exports.InspectorClanLogsModel = InspectorClanLogsModel;