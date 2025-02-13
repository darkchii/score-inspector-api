const { DataTypes } = require("@sequelize/core");

const InspectorBackgroundSourceModel = (db) => db.define('BackgroundSource', {
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true },
    source_url: { type: DataTypes.STRING },
    artist: { type: DataTypes.STRING },
    note: { type: DataTypes.STRING },
    added_by: { type: DataTypes.INTEGER },
    added_at: { type: DataTypes.DATE },
    updated_at: { type: DataTypes.DATE },
}, {
    tableName: 'inspector_beatmap_bg_source',
    timestamps: false,
});
module.exports.InspectorBackgroundSourceModel = InspectorBackgroundSourceModel;