const { Sequelize } = require("sequelize");

const InspectorUserRoleModel = (db) => db.define('UserRolePair', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    user_id: { type: Sequelize.INTEGER, allowNull: false, },
    role_id: { type: Sequelize.INTEGER, allowNull: false, },
}, {
    tableName: 'inspector_user_roles',
    timestamps: false
});
module.exports.InspectorUserRoleModel = InspectorUserRoleModel;