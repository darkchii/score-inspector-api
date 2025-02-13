const { DataTypes } = require("@sequelize/core");

const InspectorClanModel = (db) => db.define('InspectorClan', {
    id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false, },
    tag: { type: DataTypes.STRING, allowNull: false, },
    color: { type: DataTypes.STRING, allowNull: false, },
    creation_date: { type: DataTypes.DATE, allowNull: false, },
    description: { type: DataTypes.STRING, allowNull: false, },
    owner: { type: DataTypes.INTEGER, allowNull: false, },
    logo_image_url: { type: DataTypes.STRING, allowNull: true, },
    header_image_url: { type: DataTypes.STRING, allowNull: true, },
    background_image_url: { type: DataTypes.STRING, allowNull: true, },
    disable_requests: { type: DataTypes.BOOLEAN, allowNull: false, },
    disable_logs: { type: DataTypes.BOOLEAN, allowNull: false, },
    last_owner_change: { type: DataTypes.DATE, allowNull: true, },
    default_sort: { type: DataTypes.STRING },
    discord_invite: { type: DataTypes.STRING, allowNull: true, },
}, {
    tableName: 'inspector_clans',
    timestamps: false
});
module.exports.InspectorClanModel = InspectorClanModel;