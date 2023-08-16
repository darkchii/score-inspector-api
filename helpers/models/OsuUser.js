const { Sequelize } = require("sequelize");

const OsuUserModel = (db) => db.define('OsuUser', {
    user_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    username: { type: Sequelize.STRING, allowNull: false, },
    post_count: { type: Sequelize.INTEGER, allowNull: false, },
    comments_count: { type: Sequelize.INTEGER, allowNull: false, },
    level: { type: Sequelize.FLOAT, allowNull: false, },
    global_rank: { type: Sequelize.INTEGER, allowNull: false, },
    pp: { type: Sequelize.FLOAT, allowNull: false, },
    ranked_score: { type: Sequelize.BIGINT, allowNull: false, },
    playcount: { type: Sequelize.INTEGER, allowNull: false, },
    playtime: { type: Sequelize.INTEGER, allowNull: false, },
    total_score: { type: Sequelize.BIGINT, allowNull: false, },
    total_hits: { type: Sequelize.INTEGER, allowNull: false, },
    replays_watched: { type: Sequelize.INTEGER, allowNull: false, },
    ss_count: { type: Sequelize.INTEGER, allowNull: false, },
    ssh_count: { type: Sequelize.INTEGER, allowNull: false, },
    s_count: { type: Sequelize.INTEGER, allowNull: false, },
    sh_count: { type: Sequelize.INTEGER, allowNull: false, },
    a_count: { type: Sequelize.INTEGER, allowNull: false, },
    country_rank: { type: Sequelize.INTEGER, allowNull: false, },
}, {
    tableName: 'osu_users',
    timestamps: false
});
module.exports.OsuUserModel = OsuUserModel;