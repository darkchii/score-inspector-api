const { DataTypes } = require("@sequelize/core");

const InspectorBackgroundTagPairModel = (db) => db.define('BackgroundTagPair', {
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true },
    tag_id: { type: DataTypes.INTEGER, primaryKey: true },
    added_by: { type: DataTypes.INTEGER },
    added_at: { type: DataTypes.DATE },
}, {
    tableName: 'inspector_beatmap_bg_tags_pair',
    timestamps: false,
});
module.exports.InspectorBackgroundTagPairModel = InspectorBackgroundTagPairModel;