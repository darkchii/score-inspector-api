const { DataTypes } = require("@sequelize/core");

const InspectorClanLogsModel = (db) => db.define('InspectorClanLogs', {
    id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, autoIncrement: true },
    clan_id: { type: DataTypes.INTEGER, allowNull: false, },
    created_at: { type: DataTypes.DATE, allowNull: false, },
    data: { type: DataTypes.STRING, allowNull: false, },
}, {
    tableName: 'inspector_clan_logs',
    timestamps: false
});
module.exports.InspectorClanLogsModel = InspectorClanLogsModel;