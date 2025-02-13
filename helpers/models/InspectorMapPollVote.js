const { DataTypes } = require("@sequelize/core");

const InspectorMapPollVoteModel = (db) => db.define('InspectorMapPollVote', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    poll_entry_id: { type: DataTypes.INTEGER, allowNull: false },
    beatmap_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
    tableName: 'inspector_map_poll_votes',
    timestamps: false
});
module.exports.InspectorMapPollVoteModel = InspectorMapPollVoteModel;
