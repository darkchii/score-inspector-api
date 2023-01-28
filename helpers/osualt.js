const moment = require("moment/moment");
const { Op, Sequelize } = require("sequelize");
const { AltPriorityUser, AltUser, AltUniqueSS, AltUniqueFC, AltUniqueDTFC, AltUserAchievement, AltScore, AltBeatmap, AltModdedStars, Databases } = require("./db");
const { CorrectedSqlScoreMods } = require("./misc");
require('dotenv').config();

const beatmap_columns = `
beatmaps.approved, 
    beatmaps.submit_date, 
    beatmaps.approved_date, 
    beatmaps.last_update,
    beatmaps.artist,
    beatmaps.set_id,
    beatmaps.bpm,
    beatmaps.creator,
    beatmaps.creator_id,
    beatmaps.stars,
    beatmaps.diff_aim,
    beatmaps.diff_speed,
    beatmaps.cs,
    beatmaps.od,
    beatmaps.ar,
    beatmaps.hp,
    beatmaps.drain,
    beatmaps.source,
    beatmaps.genre,
    beatmaps.language,
    beatmaps.title,
    beatmaps.length,
    beatmaps.diffname,
    beatmaps.file_md5,
    beatmaps.mode,
    beatmaps.tags,
    beatmaps.favorites,
    beatmaps.rating,
    beatmaps.playcount,
    beatmaps.passcount,
    beatmaps.maxcombo,
    beatmaps.circles,
    beatmaps.sliders,
    beatmaps.spinners,
    beatmaps.storyboard,
    beatmaps.video,
    beatmaps.download_unavailable,
    beatmaps.audio_unavailable,
    beatmaps.beatmap_id
`;

const score_columns = `
    scores.user_id, 
    scores.beatmap_id, 
    scores.score, 
    scores.count300, 
    scores.count100, 
    scores.count50, 
    scores.countmiss, 
    scores.combo, 
    scores.perfect, 
    scores.enabled_mods, 
    scores.date_played, 
    scores.rank, 
    scores.pp, 
    scores.accuracy, 
    ${beatmap_columns},
    moddedsr.star_rating,
    moddedsr.aim_diff,
    moddedsr.speed_diff,
    moddedsr.fl_diff,
    moddedsr.slider_factor,
    moddedsr.speed_note_count,
    moddedsr.modded_od,
    moddedsr.modded_ar,
    moddedsr.modded_cs,
    moddedsr.modded_hp
`;

const score_columns_full = `
    scores.user_id, 
    scores.beatmap_id, 
    scores.score, 
    scores.count300, 
    scores.count100, 
    scores.count50, 
    scores.countmiss, 
    scores.combo, 
    scores.perfect, 
    scores.enabled_mods, 
    scores.date_played, 
    scores.rank, 
    scores.pp, 
    scores.accuracy, 
    ${beatmap_columns},
    moddedsr.star_rating,
    moddedsr.aim_diff,
    moddedsr.speed_diff,
    moddedsr.fl_diff,
    moddedsr.slider_factor,
    moddedsr.speed_note_count,
    moddedsr.modded_od,
    moddedsr.modded_ar,
    moddedsr.modded_cs,
    moddedsr.modded_hp,
    pack_id
    `;
module.exports.score_columns = score_columns;
module.exports.beatmap_columns = beatmap_columns;
module.exports.score_columns_full = score_columns_full;

module.exports.IsRegistered = IsRegistered;
async function IsRegistered(id) {
    let data;
    try {
        const total = await AltPriorityUser.count({ where: { user_id: id } });
        data = { registered: total > 0 };
    } catch (err) {
        throw new Error('Something went wrong, please try later...');
    }
    return data;
}

module.exports.GetAllUsers = GetAllUsers;
async function GetAllUsers() {
    let data;
    try {
        const rows = await AltUser.findAll({
            attributes: ['user_id', 'username'],
            include: [{
                model: AltPriorityUser,
                as: 'priority',
                attributes: [],
                required: true
            }]
        });
        data = rows;
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}

module.exports.GetUser = GetUser;
async function GetUser(id) {
    let data;
    try {
        const user = await AltUser.findOne({
            where: { user_id: id },
            include: [
                { model: AltUniqueSS, as: 'unique_ss', attributes: ['beatmap_id'], required: false },
                { model: AltUniqueFC, as: 'unique_fc', attributes: ['beatmap_id'], required: false },
                { model: AltUniqueDTFC, as: 'unique_dt_fc', attributes: ['beatmap_id'], required: false },
                { model: AltUserAchievement, as: 'medals', attributes: ['achievement_id', 'achieved_at'], required: false }]
        });
        data = user;
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}

module.exports.FindUser = FindUser;
async function FindUser(query, single) {
    let data;
    try {
        const rows = await AltUser.findAll({
            attributes: single ? ['*'] : ['user_id', 'username', 'country_code'],
            include: [{
                model: AltPriorityUser,
                as: 'priority',
                attributes: [],
                required: true
            }],
            where: single ? { user_id: query } : { username: { [Op.iLike]: `%${query}%` } },
        });
        if (single) {
            if (rows.length == 0)
                throw new Error('No user found');
            else
                data = rows[0];
        } else {
            data = rows;
        }
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}

module.exports.GetBestScores = GetBestScores;
async function GetBestScores(period, stat, limit, loved = false) {
    let data;
    try {
        let period_check = null;
        switch (period) {
            case 'day':
                period_check = 1;
                break;
            case 'week':
                period_check = 7;
                break;
            case 'month':
                period_check = 31;
                break;
            case 'year':
                period_check = 365;
                break;
            case 'all':
                period_check = null;
                break;
        }
        const rows = await AltScore.findAll({
            include: [
                { model: AltUser, as: 'user', required: true },
                {
                    model: AltBeatmap, as: 'beatmap', where: { approved: { [Op.or]: [1, 2, loved ? 4 : null] } }, required: true,
                    include: [
                        { model: AltModdedStars, as: 'modded_sr', where: { mods_enum: { [Op.eq]: Sequelize.literal(CorrectedSqlScoreMods) } } }
                    ]
                }
            ],
            where: period_check !== null ? { date_played: { [Op.gt]: moment().subtract(period_check, 'days').toDate() } } : null,
            order: [[stat, 'DESC']],
            limit: limit
        });
        data = rows;
    } catch (err) {
        console.error(err);
        throw new Error(err.message);
    }
    return data;
}

module.exports.GetSystemInfo = GetSystemInfo;
async function GetSystemInfo() {
    let data;
    try {
        const total_scores = await AltScore.count();
        const total_users = await AltUser.count();
        const tracked_users = await AltPriorityUser.count();
        const [size, _] = await Databases.osuAlt.query(`SELECT pg_database_size('osu') as c`);
        data = { total_scores, total_users, tracked_users, size: size[0].c };
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}