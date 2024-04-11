const { Sequelize } = require("sequelize");

const InspectorMapPollVoteModel = (db) => db.define('InspectorMapPollVote', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    user_id: { type: Sequelize.INTEGER, allowNull: false },
    poll_entry_id: { type: Sequelize.INTEGER, allowNull: false },
    beatmap_id: { type: Sequelize.INTEGER, allowNull: false },
}, {
    tableName: 'inspector_map_poll_votes',
    timestamps: false
});
module.exports.InspectorMapPollVoteModel = InspectorMapPollVoteModel;
