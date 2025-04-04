const { DataTypes } = require("@sequelize/core");

const InspectorClanMemberModel = (db) => db.define('InspectorClanMember', {
    osu_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    clan_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    join_date: { type: DataTypes.DATE, allowNull: false, },
    pending: { type: DataTypes.BOOLEAN, allowNull: false, },
    is_moderator: { type: DataTypes.BOOLEAN, allowNull: false, },
}, {
    tableName: 'inspector_clan_members',
    timestamps: false
});
module.exports.InspectorClanMemberModel = InspectorClanMemberModel;