const { Sequelize } = require("sequelize");

const InspectorTokenModel = (db) => db.define('Token', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    token: { type: Sequelize.STRING, allowNull: false, },
    osu_id: { type: Sequelize.INTEGER, allowNull: false, },
    date_created: { type: Sequelize.DATE, allowNull: false, },
}, {
    tableName: 'inspector_tokens',
    timestamps: false
});
module.exports.InspectorTokenModel = InspectorTokenModel;