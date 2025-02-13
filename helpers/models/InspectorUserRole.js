const { DataTypes } = require("@sequelize/core");

const InspectorUserRoleModel = (db) => db.define('UserRolePair', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    user_id: { type: DataTypes.INTEGER, allowNull: false, },
    role_id: { type: DataTypes.INTEGER, allowNull: false, },
}, {
    tableName: 'inspector_user_roles',
    timestamps: false
});
module.exports.InspectorUserRoleModel = InspectorUserRoleModel;