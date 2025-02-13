const { DataTypes } = require("@sequelize/core");

const InspectorBackgroundTagModel = (db) => db.define('BackgroundTag', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tag: { type: DataTypes.STRING },
    description: { type: DataTypes.STRING },
    color: { type: DataTypes.STRING },
}, {
    tableName: 'inspector_beatmap_bg_tags',
    timestamps: false,
});
module.exports.InspectorBackgroundTagModel = InspectorBackgroundTagModel;