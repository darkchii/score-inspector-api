const { Sequelize } = require("sequelize");

const InspectorBackgroundTagModel = (db) => db.define('BackgroundTag', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    tag: { type: Sequelize.STRING },
    description: { type: Sequelize.STRING },
    color: { type: Sequelize.STRING },
}, {
    tableName: 'inspector_beatmap_bg_tags',
    timestamps: false,
});
module.exports.InspectorBackgroundTagModel = InspectorBackgroundTagModel;