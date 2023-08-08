const { Sequelize } = require("sequelize");

const InspectorRoleModel = (db) => db.define('Role', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    title: { type: Sequelize.STRING, allowNull: false, },
    description: { type: Sequelize.STRING, allowNull: false, },
    icon: { type: Sequelize.STRING, allowNull: false, },
    color: { type: Sequelize.STRING, allowNull: false, },
    is_visible: { type: Sequelize.BOOLEAN, allowNull: false, },
    is_admin: { type: Sequelize.BOOLEAN, allowNull: false, },
    is_listed: { type: Sequelize.BOOLEAN, allowNull: false, },
}, {
    tableName: 'inspector_roles',
    timestamps: false
});
module.exports.InspectorRoleModel = InspectorRoleModel;