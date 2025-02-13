const { DataTypes } = require("@sequelize/core");

const InspectorRoleModel = (db) => db.define('Role', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    title: { type: DataTypes.STRING, allowNull: false, },
    description: { type: DataTypes.STRING, allowNull: false, },
    icon: { type: DataTypes.STRING, allowNull: false, },
    color: { type: DataTypes.STRING, allowNull: false, },
    is_visible: { type: DataTypes.BOOLEAN, allowNull: false, },
    is_admin: { type: DataTypes.BOOLEAN, allowNull: false, },
    is_listed: { type: DataTypes.BOOLEAN, allowNull: false, },
}, {
    tableName: 'inspector_roles',
    timestamps: false
});
module.exports.InspectorRoleModel = InspectorRoleModel;