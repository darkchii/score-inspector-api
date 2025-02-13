const { DataTypes } = require("@sequelize/core");

const InspectorPerformanceRecordModel = (db, version) => db.define('PPRecord', {
    beatmap_id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    pp: { type: DataTypes.FLOAT, allowNull: false, },
    date_played: { type: DataTypes.DATE, allowNull: false, },
}, {
    tableName: `scores_pp_records`,
    timestamps: false,

});
module.exports.InspectorPerformanceRecordModel = InspectorPerformanceRecordModel;