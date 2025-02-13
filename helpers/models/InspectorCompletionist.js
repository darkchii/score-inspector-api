const { DataTypes } = require("@sequelize/core");

const InspectorCompletionistModel = (db) => db.define('Completionist', {
    osu_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    mode: { type: DataTypes.INTEGER, allowNull: false, },
    completion_date: { type: DataTypes.DATE, allowNull: false, },
    scores: { type: DataTypes.INTEGER, allowNull: false, },
}, {
    tableName: 'osu_completionists',
    timestamps: false,
});
module.exports.InspectorCompletionistModel = InspectorCompletionistModel;