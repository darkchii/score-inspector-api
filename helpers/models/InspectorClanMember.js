const { Sequelize } = require("sequelize");

const InspectorClanMemberModel = (db) => db.define('InspectorClanMember', {
    osu_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    clan_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    join_date: { type: Sequelize.DATE, allowNull: false, },
    pending: { type: Sequelize.BOOLEAN, allowNull: false, },
    is_moderator: { type: Sequelize.BOOLEAN, allowNull: false, },
}, {
    tableName: 'inspector_clan_members',
    timestamps: false
});
module.exports.InspectorClanMemberModel = InspectorClanMemberModel;