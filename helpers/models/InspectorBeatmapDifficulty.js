const { Sequelize } = require("sequelize");

const InspectorBeatmapDifficultyModel = (db) => db.define('InspectorBeatmapDifficultyData', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true },
    mode: { type: Sequelize.INTEGER, primaryKey: true },
    mods: { type: Sequelize.INTEGER, primaryKey: true },
    diff_unified: { type: Sequelize.FLOAT },
    diff_aim: { type: Sequelize.FLOAT },
    diff_speed: { type: Sequelize.FLOAT },
    od: { type: Sequelize.FLOAT },
    ar: { type: Sequelize.FLOAT },
    max_combo: { type: Sequelize.INTEGER },
    diff_strain: { type: Sequelize.FLOAT },
    hit300: { type: Sequelize.FLOAT },
    score_multiplier: { type: Sequelize.FLOAT },
    flashlight_rating: { type: Sequelize.FLOAT },
    slider_factor: { type: Sequelize.FLOAT },
    speed_note_count: { type: Sequelize.INTEGER },
    speed_difficult_strain_count: { type: Sequelize.INTEGER },
    aim_difficult_strain_count: { type: Sequelize.INTEGER },
    hit100: { type: Sequelize.FLOAT },
    mono_stamina_factor: { type: Sequelize.FLOAT },
}, {
    tableName: 'osu_beatmap_difficulty_data',
    timestamps: false,
});
module.exports.InspectorBeatmapDifficultyModel = InspectorBeatmapDifficultyModel;