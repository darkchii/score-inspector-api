const { DataTypes } = require("@sequelize/core");

const OsuTeamRulesetModel = (db) => db.define('OsuTeamRulesetModel', {
    id: { type: DataTypes.INTEGER, primaryKey: true, },
    mode: { type: DataTypes.STRING, primaryKey: true, },
    play_count: { type: DataTypes.INTEGER, allowNull: false, },
    ranked_score: { type: DataTypes.INTEGER, allowNull: false, },
    average_score: { type: DataTypes.INTEGER, allowNull: false, },
    performance: { type: DataTypes.INTEGER, allowNull: false, },
    clears: { type: DataTypes.INTEGER, allowNull: false, },
    total_ss: { type: DataTypes.INTEGER, allowNull: false, },
    total_s: { type: DataTypes.INTEGER, allowNull: false, },
    total_a: { type: DataTypes.INTEGER, allowNull: false, },
    total_score: { type: DataTypes.INTEGER, allowNull: false, },
    play_time: { type: DataTypes.INTEGER, allowNull: false, },
    total_hits: { type: DataTypes.INTEGER, allowNull: false, },
    replays_watched: { type: DataTypes.INTEGER, allowNull: false, }
}, {
    tableName: 'osu_teams_ruleset',
    timestamps: false
});
module.exports.OsuTeamRulesetModel = OsuTeamRulesetModel;