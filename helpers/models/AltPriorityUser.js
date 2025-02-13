const { DataTypes } = require("@sequelize/core");

const AltPriorityUserModel = (db) => db.define('PriorityUser', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
}, {
    tableName: 'priorityuser',
    timestamps: false,
});
module.exports.AltPriorityUserModel = AltPriorityUserModel;