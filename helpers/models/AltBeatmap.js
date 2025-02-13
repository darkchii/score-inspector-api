const { DataTypes } = require("@sequelize/core");
const moment = require("moment");

const AltBeatmapModel = (db) => db.define('Beatmap', {
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false, },
    approved: { type: DataTypes.INTEGER, allowNull: false, },
    submit_date: {
        type: DataTypes.DATE, allowNull: false,
        get() {
            const rawValue = this.getDataValue('submit_date');
            return moment(rawValue).format('YYYY-MM-DDTHH:mm:ss[Z]');
        },
    },
    approved_date: { type: DataTypes.DATE, allowNull: false, 
        get() {
            const rawValue = this.getDataValue('approved_date');
            return moment(rawValue).format('YYYY-MM-DDTHH:mm:ss[Z]');
        },
    },
    last_update: { type: DataTypes.DATE, allowNull: false,
        get() {
            const rawValue = this.getDataValue('last_update');
            return moment(rawValue).format('YYYY-MM-DDTHH:mm:ss[Z]');
        },
     },
    artist: { type: DataTypes.STRING, allowNull: false, },
    set_id: { type: DataTypes.INTEGER, allowNull: false, },
    bpm: { type: DataTypes.FLOAT, allowNull: false, },
    creator: { type: DataTypes.STRING, allowNull: false, },
    creator_id: { type: DataTypes.INTEGER, allowNull: false, },
    stars: { type: DataTypes.FLOAT, allowNull: false, },
    diff_aim: { type: DataTypes.FLOAT, allowNull: false, },
    diff_speed: { type: DataTypes.FLOAT, allowNull: false, },
    cs: { type: DataTypes.FLOAT, allowNull: false, },
    od: { type: DataTypes.FLOAT, allowNull: false, },
    ar: { type: DataTypes.FLOAT, allowNull: false, },
    hp: { type: DataTypes.FLOAT, allowNull: false, },
    drain: { type: DataTypes.FLOAT, allowNull: false, },
    source: { type: DataTypes.STRING, allowNull: false, },
    genre: { type: DataTypes.INTEGER, allowNull: false, },
    language: { type: DataTypes.INTEGER, allowNull: false, },
    title: { type: DataTypes.STRING, allowNull: false, },
    length: { type: DataTypes.INTEGER, allowNull: false, },
    diffname: { type: DataTypes.STRING, allowNull: false, },
    file_md5: { type: DataTypes.STRING, allowNull: false, },
    mode: { type: DataTypes.INTEGER, allowNull: false, },
    tags: { type: DataTypes.STRING, allowNull: false, },
    favorites: { type: DataTypes.INTEGER, allowNull: false, },
    rating: { type: DataTypes.FLOAT, allowNull: false, },
    playcount: { type: DataTypes.INTEGER, allowNull: false, },
    passcount: { type: DataTypes.INTEGER, allowNull: false, },
    circles: { type: DataTypes.INTEGER, allowNull: false, },
    sliders: { type: DataTypes.INTEGER, allowNull: false, },
    spinners: { type: DataTypes.INTEGER, allowNull: false, },
    maxcombo: { type: DataTypes.INTEGER, allowNull: false, },
    storyboard: { type: DataTypes.INTEGER, allowNull: false, },
    video: { type: DataTypes.INTEGER, allowNull: false, },
    download_unavailable: { type: DataTypes.INTEGER, allowNull: false, },
    audio_unavailable: { type: DataTypes.INTEGER, allowNull: false, }
}, {
    tableName: 'beatmaps',
    timestamps: false
});
module.exports.AltBeatmapModel = AltBeatmapModel;