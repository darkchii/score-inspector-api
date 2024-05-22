const { Sequelize } = require("sequelize");

const InspectorCompletionistModel = (db) => db.define('Completionist', {
    osu_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    mode: { type: Sequelize.INTEGER, allowNull: false, },
    completion_date: { type: Sequelize.DATE, allowNull: false, },
    scores: { type: Sequelize.INTEGER, allowNull: false, },
}, {
    tableName: 'osu_completionists',
    timestamps: false,
});
module.exports.InspectorCompletionistModel = InspectorCompletionistModel;