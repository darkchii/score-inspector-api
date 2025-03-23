const { DataTypes } = require("@sequelize/core");

const OsuTeamModel = (db) => db.define('OsuTeam', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    name: { type: DataTypes.STRING, allowNull: false, },
    short_name: { type: DataTypes.STRING, allowNull: true, },
    flag_url: { type: DataTypes.STRING, allowNull: true, },
    members: { type: DataTypes.INTEGER, allowNull: true, },
    deleted: { type: DataTypes.BOOLEAN, allowNull: true, },
    applications_open: { type: DataTypes.BOOLEAN, allowNull: true, },
    header_url: { type: DataTypes.STRING, allowNull: true, },
    url: { type: DataTypes.STRING, allowNull: true, },
    color: { type: DataTypes.STRING, allowNull: true, },
}, {
    tableName: 'osu_teams',
    timestamps: false
});
module.exports.OsuTeamModel = OsuTeamModel;