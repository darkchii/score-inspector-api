const { Sequelize } = require("sequelize");

const InspectorPerformanceRecordModel = (db, version) => db.define('PPRecord', {
    beatmap_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true },
    user_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true },
    pp: { type: Sequelize.FLOAT, allowNull: false, },
    date_played: { type: Sequelize.DATE, allowNull: false, },
}, {
    tableName: `scores_pp_records`,
    timestamps: false,

});
module.exports.InspectorPerformanceRecordModel = InspectorPerformanceRecordModel;