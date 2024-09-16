const { Sequelize } = require("sequelize");

const InspectorBackgroundSourceModel = (db) => db.define('BackgroundSource', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true },
    source_url: { type: Sequelize.STRING },
    artist: { type: Sequelize.STRING },
    note: { type: Sequelize.STRING },
    added_by: { type: Sequelize.INTEGER },
    added_at: { type: Sequelize.DATE },
    updated_at: { type: Sequelize.DATE },
}, {
    tableName: 'inspector_beatmap_bg_source',
    timestamps: false,
});
module.exports.InspectorBackgroundSourceModel = InspectorBackgroundSourceModel;