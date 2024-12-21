const { Sequelize } = require("sequelize");

const InspectorClanStatsModel = (db) => db.define('InspectorClanStats', {
    clan_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    total_ss: { type: Sequelize.INTEGER, allowNull: true, },
    total_ssh: { type: Sequelize.INTEGER, allowNull: true, },
    total_ss_both: { type: Sequelize.INTEGER, allowNull: true, },
    total_s: { type: Sequelize.INTEGER, allowNull: true, },
    total_sh: { type: Sequelize.INTEGER, allowNull: true, },
    total_s_both: { type: Sequelize.INTEGER, allowNull: true, },
    total_a: { type: Sequelize.INTEGER, allowNull: true, },
    total_b: { type: Sequelize.INTEGER, allowNull: true, },
    total_c: { type: Sequelize.INTEGER, allowNull: true, },
    total_d: { type: Sequelize.INTEGER, allowNull: true, },
    playcount: { type: Sequelize.INTEGER, allowNull: true, },
    playtime: { type: Sequelize.INTEGER, allowNull: true, },
    ranked_score: { type: Sequelize.BIGINT, allowNull: true, },
    total_score: { type: Sequelize.BIGINT, allowNull: true, },
    replays_watched: { type: Sequelize.INTEGER, allowNull: true, },
    total_hits: { type: Sequelize.INTEGER, allowNull: true, },
    average_pp: { type: Sequelize.FLOAT, allowNull: true, },
    total_pp: { type: Sequelize.FLOAT, allowNull: true, },
    accuracy: { type: Sequelize.FLOAT, allowNull: true, },
    clears: { type: Sequelize.INTEGER, allowNull: true, },
    members: { type: Sequelize.INTEGER, allowNull: true, },
    medals: { type: Sequelize.INTEGER, allowNull: true, },
    badges: { type: Sequelize.INTEGER, allowNull: true, },
    xp: { type: Sequelize.DOUBLE, allowNull: true, },
}, {
    tableName: 'inspector_clan_stats',
    timestamps: false
});
module.exports.InspectorClanStatsModel = InspectorClanStatsModel;