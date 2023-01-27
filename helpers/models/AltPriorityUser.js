const { Sequelize } = require("sequelize");

const AltPriorityUserModel = (db) => db.define('PriorityUser', {
    user_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
}, {
    tableName: 'priorityuser',
    timestamps: false,
});
module.exports.AltPriorityUserModel = AltPriorityUserModel;