const { DataTypes } = require("@sequelize/core");

const InspectorBeatmapDifficultyModel = (db) => db.define('InspectorBeatmapDifficultyData', {
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true },
    mode: { type: DataTypes.INTEGER, primaryKey: true },
    mods: { type: DataTypes.INTEGER, primaryKey: true },
    diff_unified: { type: DataTypes.FLOAT },
    diff_aim: { type: DataTypes.FLOAT },
    diff_speed: { type: DataTypes.FLOAT },
    od: { type: DataTypes.FLOAT },
    ar: { type: DataTypes.FLOAT },
    max_combo: { type: DataTypes.INTEGER },
    diff_strain: { type: DataTypes.FLOAT },
    hit300: { type: DataTypes.FLOAT },
    score_multiplier: { type: DataTypes.FLOAT },
    flashlight_rating: { type: DataTypes.FLOAT },
    slider_factor: { type: DataTypes.FLOAT },
    speed_note_count: { type: DataTypes.INTEGER },
    speed_difficult_strain_count: { type: DataTypes.INTEGER },
    aim_difficult_strain_count: { type: DataTypes.INTEGER },
    hit100: { type: DataTypes.FLOAT },
    mono_stamina_factor: { type: DataTypes.FLOAT },
}, {
    tableName: 'osu_beatmap_difficulty_data',
    timestamps: false,
});
module.exports.InspectorBeatmapDifficultyModel = InspectorBeatmapDifficultyModel;