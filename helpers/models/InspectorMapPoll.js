const { Sequelize } = require("sequelize");

const InspectorMapPollModel = (db) => db.define('InspectorMapPoll', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    poll_id: { type: Sequelize.STRING, allowNull: false },
    beatmap_id: { type: Sequelize.INTEGER, allowNull: false },
    date: { type: Sequelize.DATE, allowNull: false, },
}, {
    tableName: 'inspector_map_polls',
    timestamps: false
});
module.exports.InspectorMapPollModel = InspectorMapPollModel;