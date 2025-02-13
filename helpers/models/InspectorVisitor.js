const { DataTypes } = require("@sequelize/core");

const InspectorVisitorModel = (db) => db.define('Visitor', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    visitor_id: { type: DataTypes.INTEGER, allowNull: true, },
    target_id: { type: DataTypes.INTEGER, allowNull: false, },
    last_visit: { type: DataTypes.DATE, allowNull: false, },
    count: { type: DataTypes.INTEGER, allowNull: false, },
}, {
    tableName: 'inspector_visitors',
    timestamps: false
});
module.exports.InspectorVisitorModel = InspectorVisitorModel;