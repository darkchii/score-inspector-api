const { Sequelize } = require("sequelize");

const InspectorVisitorModel = (db) => db.define('Visitor', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    visitor_id: { type: Sequelize.INTEGER, allowNull: true, },
    target_id: { type: Sequelize.INTEGER, allowNull: false, },
    last_visit: { type: Sequelize.DATE, allowNull: false, },
    count: { type: Sequelize.INTEGER, allowNull: false, },
}, {
    tableName: 'inspector_visitors',
    timestamps: false
});
module.exports.InspectorVisitorModel = InspectorVisitorModel;