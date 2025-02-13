const { DataTypes } = require("@sequelize/core");

const InspectorClanStatsModel = (db) => db.define('InspectorClanStats', {
    clan_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    total_ss: { type: DataTypes.INTEGER, allowNull: true, },
    total_ssh: { type: DataTypes.INTEGER, allowNull: true, },
    total_ss_both: { type: DataTypes.INTEGER, allowNull: true, },
    total_s: { type: DataTypes.INTEGER, allowNull: true, },
    total_sh: { type: DataTypes.INTEGER, allowNull: true, },
    total_s_both: { type: DataTypes.INTEGER, allowNull: true, },
    total_a: { type: DataTypes.INTEGER, allowNull: true, },
    total_b: { type: DataTypes.INTEGER, allowNull: true, },
    total_c: { type: DataTypes.INTEGER, allowNull: true, },
    total_d: { type: DataTypes.INTEGER, allowNull: true, },
    playcount: { type: DataTypes.INTEGER, allowNull: true, },
    playtime: { type: DataTypes.INTEGER, allowNull: true, },
    ranked_score: { type: DataTypes.BIGINT, allowNull: true, },
    total_score: { type: DataTypes.BIGINT, allowNull: true, },
    replays_watched: { type: DataTypes.INTEGER, allowNull: true, },
    total_hits: { type: DataTypes.INTEGER, allowNull: true, },
    average_pp: { type: DataTypes.FLOAT, allowNull: true, },
    total_pp: { type: DataTypes.FLOAT, allowNull: true, },
    accuracy: { type: DataTypes.FLOAT, allowNull: true, },
    clears: { type: DataTypes.INTEGER, allowNull: true, },
    members: { type: DataTypes.INTEGER, allowNull: true, },
    medals: { type: DataTypes.INTEGER, allowNull: true, },
    badges: { type: DataTypes.INTEGER, allowNull: true, },
    xp: { type: DataTypes.DOUBLE, allowNull: true, },
}, {
    tableName: 'inspector_clan_stats',
    timestamps: false
});
module.exports.InspectorClanStatsModel = InspectorClanStatsModel;