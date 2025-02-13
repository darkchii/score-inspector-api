const { DataTypes } = require("@sequelize/core");

const InspectorMapPollModel = (db) => db.define('InspectorMapPoll', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    poll_id: { type: DataTypes.STRING, allowNull: false },
    beatmap_id: { type: DataTypes.INTEGER, allowNull: false },
    date: { type: DataTypes.DATE, allowNull: false, },
}, {
    tableName: 'inspector_map_polls',
    timestamps: false
});
module.exports.InspectorMapPollModel = InspectorMapPollModel;