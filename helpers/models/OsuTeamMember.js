const { DataTypes } = require("@sequelize/core");

const OsuTeamMemberModel = (db) => db.define('OsuTeamMemberModel', {
    team_id: { type: DataTypes.INTEGER, primaryKey: true, },
    user_id: { type: DataTypes.INTEGER, primaryKey: true, },
    is_leader: { type: DataTypes.BOOLEAN, allowNull: false, },
}, {
    tableName: 'osu_teams_members',
    timestamps: false
});
module.exports.OsuTeamMemberModel = OsuTeamMemberModel;