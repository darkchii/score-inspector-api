const { DataTypes } = require("@sequelize/core");

const InspectorMedalModel = (db) => db.define('Medal', {
    medal_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false, },
    name: { type: DataTypes.STRING, allowNull: false, },
    icon_url: { type: DataTypes.STRING, allowNull: false, },
    description: { type: DataTypes.STRING, allowNull: false, },
    category: { type: DataTypes.STRING, allowNull: false, },
    ordering: { type: DataTypes.INTEGER, allowNull: false, },
}, {
    tableName: 'osu_medals',
    timestamps: false
});
module.exports.InspectorMedalModel = InspectorMedalModel;