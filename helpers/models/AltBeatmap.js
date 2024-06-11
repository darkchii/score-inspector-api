const { Sequelize } = require("sequelize");
const moment = require("moment");

const AltBeatmapModel = (db) => db.define('Beatmap', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, },
    approved: { type: Sequelize.INTEGER, allowNull: false, },
    submit_date: {
        type: Sequelize.DATE, allowNull: false,
        get() {
            const rawValue = this.getDataValue('submit_date');
            return moment(rawValue).format('YYYY-MM-DDTHH:mm:ss[Z]');
        },
    },
    approved_date: { type: Sequelize.DATE, allowNull: false, 
        get() {
            const rawValue = this.getDataValue('approved_date');
            return moment(rawValue).format('YYYY-MM-DDTHH:mm:ss[Z]');
        },
    },
    last_update: { type: Sequelize.DATE, allowNull: false,
        get() {
            const rawValue = this.getDataValue('last_update');
            return moment(rawValue).format('YYYY-MM-DDTHH:mm:ss[Z]');
        },
     },
    artist: { type: Sequelize.STRING, allowNull: false, },
    set_id: { type: Sequelize.INTEGER, allowNull: false, },
    bpm: { type: Sequelize.FLOAT, allowNull: false, },
    creator: { type: Sequelize.STRING, allowNull: false, },
    creator_id: { type: Sequelize.INTEGER, allowNull: false, },
    stars: { type: Sequelize.FLOAT, allowNull: false, },
    diff_aim: { type: Sequelize.FLOAT, allowNull: false, },
    diff_speed: { type: Sequelize.FLOAT, allowNull: false, },
    cs: { type: Sequelize.FLOAT, allowNull: false, },
    od: { type: Sequelize.FLOAT, allowNull: false, },
    ar: { type: Sequelize.FLOAT, allowNull: false, },
    hp: { type: Sequelize.FLOAT, allowNull: false, },
    drain: { type: Sequelize.FLOAT, allowNull: false, },
    source: { type: Sequelize.STRING, allowNull: false, },
    genre: { type: Sequelize.INTEGER, allowNull: false, },
    language: { type: Sequelize.INTEGER, allowNull: false, },
    title: { type: Sequelize.STRING, allowNull: false, },
    length: { type: Sequelize.INTEGER, allowNull: false, },
    diffname: { type: Sequelize.STRING, allowNull: false, },
    file_md5: { type: Sequelize.STRING, allowNull: false, },
    mode: { type: Sequelize.INTEGER, allowNull: false, },
    tags: { type: Sequelize.STRING, allowNull: false, },
    favorites: { type: Sequelize.INTEGER, allowNull: false, },
    rating: { type: Sequelize.FLOAT, allowNull: false, },
    playcount: { type: Sequelize.INTEGER, allowNull: false, },
    passcount: { type: Sequelize.INTEGER, allowNull: false, },
    circles: { type: Sequelize.INTEGER, allowNull: false, },
    sliders: { type: Sequelize.INTEGER, allowNull: false, },
    spinners: { type: Sequelize.INTEGER, allowNull: false, },
    maxcombo: { type: Sequelize.INTEGER, allowNull: false, },
    storyboard: { type: Sequelize.INTEGER, allowNull: false, },
    video: { type: Sequelize.INTEGER, allowNull: false, },
    download_unavailable: { type: Sequelize.INTEGER, allowNull: false, },
    audio_unavailable: { type: Sequelize.INTEGER, allowNull: false, }
}, {
    tableName: 'beatmaps',
    timestamps: false
});
module.exports.AltBeatmapModel = AltBeatmapModel;