const { Sequelize } = require("sequelize");

const InspectorMedalModel = (db) => db.define('Medal', {
    medal_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: false, },
    name: { type: Sequelize.STRING, allowNull: false, },
    icon_url: { type: Sequelize.STRING, allowNull: false, },
    description: { type: Sequelize.STRING, allowNull: false, },
    category: { type: Sequelize.STRING, allowNull: false, },
    ordering: { type: Sequelize.INTEGER, allowNull: false, },
}, {
    tableName: 'osu_medals',
    timestamps: false
});
module.exports.InspectorMedalModel = InspectorMedalModel;