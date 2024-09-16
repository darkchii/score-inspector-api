const { Sequelize } = require("sequelize");

const InspectorBackgroundTagPairModel = (db) => db.define('BackgroundTagPair', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true },
    tag_id: { type: Sequelize.INTEGER, primaryKey: true },
    added_by: { type: Sequelize.INTEGER },
    added_at: { type: Sequelize.DATE },
}, {
    tableName: 'inspector_beatmap_bg_tags_pair',
    timestamps: false,
});
module.exports.InspectorBackgroundTagPairModel = InspectorBackgroundTagPairModel;