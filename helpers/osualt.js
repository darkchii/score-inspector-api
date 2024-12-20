const moment = require("moment/moment");
const { Op, Sequelize, where } = require("sequelize");
const { AltPriorityUser, AltUser, AltUniqueSS, AltUniqueFC, AltUniqueDTFC, AltUserAchievement, AltScore, AltBeatmap, Databases, InspectorUser, InspectorScoreStat, InspectorClanMember, InspectorClan, InspectorOsuUser, AltScoreMods } = require("./db");
const { CorrectedSqlScoreMods, CorrectedSqlScoreModsCustom } = require("./misc");
const { default: axios } = require("axios");
const { GetOsuUsers, ApplyDifficultyData } = require("./osu");
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

module.exports.UpdateUser = UpdateUser;
async function UpdateUser(user_id) {
    //check if user is a sequelize object or an id
    const user_obj = await InspectorOsuUser.findOne({ where: { user_id } });

    if (!user_obj) {
        return null;
    }

    const scores_B = await AltScore.count({ where: { user_id: user_id, rank: 'B' } });
    const scores_C = await AltScore.count({ where: { user_id: user_id, rank: 'C' } });
    const scores_D = await AltScore.count({ where: { user_id: user_id, rank: 'D' } });
    const total_pp = await AltScore.sum('pp', { where: { user_id: user_id } });

    //set b_count to either scores_B, keep b_count or 0
    user_obj.b_count = scores_B ?? user_obj.b_count ?? 0;
    user_obj.c_count = scores_C ?? user_obj.c_count ?? 0;
    user_obj.d_count = scores_D ?? user_obj.d_count ?? 0;
    user_obj.total_pp = total_pp ?? user_obj.total_pp ?? 0;

    //save
    await user_obj.save();

    return user_obj;
}

module.exports.IsRegistered = IsRegistered;
async function IsRegistered(id) {
    let data;
    try {
        const exists = await AltPriorityUser.findByPk(id);
        data = { registered: exists ? true : false };
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

module.exports.GetAltUsers = GetAltUsers;
async function GetAltUsers(id_array, include_sub_data = true, forceLocalAlt = false) {
    let data;
    try {
        let _id_array = id_array;
        if (!Array.isArray(id_array)) _id_array = id_array.split(',');
        const fetch = {
            where: { user_id: _id_array },
            include: (include_sub_data && !forceLocalAlt) ? [
                { model: AltUniqueSS, as: 'unique_ss', attributes: ['beatmap_id'], required: false },
                { model: AltUniqueFC, as: 'unique_fc', attributes: ['beatmap_id'], required: false },
                { model: AltUniqueDTFC, as: 'unique_dt_fc', attributes: ['beatmap_id'], required: false },
                // { model: AltUserAchievement, as: 'medals', attributes: ['achievement_id', 'achieved_at'], required: false }
            ]
                : [],
        }
        const rows = await (forceLocalAlt ? InspectorOsuUser : AltUser).findAll(fetch);

        //do achievements separately, for some reason nodejs crashes when trying to include it in the query
        const _rows = JSON.parse(JSON.stringify(rows));

        if (include_sub_data) {
            const achievements = await AltUserAchievement.findAll({
                where: { user_id: _id_array },
                attributes: ['user_id', 'achievement_id', 'achieved_at']
            });

            //clone rows so it becomes writable

            for (let i = 0; i < _rows.length; i++) {
                _rows[i].medals = achievements.filter(x => x.user_id == _rows[i].user_id);
            }
        }

        data = _rows;
    } catch (err) {
        console.log(err);
        throw new Error(err.message);
    }
    return data;
}


module.exports.FindUser = FindUser;
async function FindUser(query, single, requirePriority = true) {
    let data;
    try {
        let rows = await AltUser.findAll({
            attributes: single ? ['*'] : ['user_id', 'username', 'country_code', 'global_rank'],
            include: [{
                model: AltPriorityUser,
                as: 'priority',
                attributes: [],
                required: requirePriority
            }],
            //order by rank but remove sign
            order: [
                [Sequelize.fn('SIGN', Sequelize.col('global_rank')), 'DESC'],
                [Sequelize.fn('ABS', Sequelize.col('global_rank')), 'ASC']
            ],
            where: single ? { user_id: query } : { username: { [Op.iLike]: `%${query}%` } },
        });

        if (rows.length > 0) {
            //find or create proxy inspector user
            rows = JSON.parse(JSON.stringify(rows));

            const user_ids = rows.map(x => x.user_id);
            const inspector_users = await InspectorUser.findAll({
                where: { osu_id: { [Op.in]: user_ids } },
                include: [
                    {
                        model: InspectorClanMember,
                        attributes: ['osu_id', 'clan_id', 'join_date', 'pending'],
                        as: 'clan_member',
                        include: [{
                            model: InspectorClan,
                            attributes: ['id', 'name', 'tag', 'color', 'creation_date', 'description', 'owner'],
                            as: 'clan',
                        }]
                    }
                ]
            });

            let osu_users = [];
            let rank_users = [];

            //split ids into chunks of 50
            const chunk_size = 50;
            const chunks = [];
            for (let i = 0; i < user_ids.length; i += chunk_size) {
                chunks.push(user_ids.slice(i, i + chunk_size));
            }

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const osu_users_chunk = await GetOsuUsers(chunk);
                osu_users = osu_users.concat(osu_users_chunk);

                let scoreRes = await axios.get(`https://score.respektive.pw/u/${chunk.join(',')}`, {
                    headers: { "Accept-Encoding": "gzip,deflate,compress" }
                });
                rank_users = rank_users.concat(JSON.parse(JSON.stringify(scoreRes?.data)));
            }

            for (let i = 0; i < rows.length; i++) {
                const inspector_user = inspector_users?.find(x => x.osu_id == rows[i].user_id);
                const osu_user = osu_users?.find(x => x.id == rows[i].user_id);
                const rank_user = rank_users?.find(x => x.user_id == rows[i].user_id);


                if (osu_user) {
                    rows[i].osu = osu_user;
                    if (rank_user) {
                        rows[i].osu.score_rank = rank_user;
                    }
                }

                if (inspector_user) {
                    rows[i].inspector_user = inspector_user;
                } else {
                    rows[i].inspector_user = {
                        id: null,
                        osu_id: rows[i].user_id,
                        known_username: rows[i].username,
                        roles: []
                    }
                }
            }

            //remove rows that dont have an osu user
            rows = rows.filter(x => x.osu);
        }

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
        let period_check_query = null;

        switch(period){
            case 'day':
                //scores set since 0 utc today
                period_check_query = `date_played >= date_trunc('day', now()::date) AND date_played < date_trunc('day', now()::date) + interval '1 day'`;
                break;
            case 'week':
                //scores set since 0 utc today
                period_check_query = `date_played >= date_trunc('week', now()::date) AND date_played < date_trunc('week', now()::date) + interval '1 week'`;
                break;
            case 'month':
                //scores set since 0 utc today
                period_check_query = `date_played >= date_trunc('month', now()::date) AND date_played < date_trunc('month', now()::date) + interval '1 month'`;
                break;
            case 'year':
                //scores set since 0 utc today
                period_check_query = `date_played >= date_trunc('year', now()::date) AND date_played < date_trunc('year', now()::date) + interval '1 year'`;
                break;
            case 'all':
                break;
        }


        //create a subquery which orders and limits the scores, then afterwards join the users and beatmaps
        const query = `
            SELECT *
            FROM scores
            WHERE ${stat} > 0 AND ${stat} IS NOT NULL AND ${stat} <> 'NaN'::NUMERIC
            ${period_check_query ? `AND ${period_check_query}` : ''}
            AND user_id in (select user_id from users2)
            ORDER BY ${stat} DESC
            LIMIT ${limit}
        `;
        //+5 limit to account for cheaters.

        const rows = await Databases.osuAlt.query(query);

        data = rows[0];

        const users = await GetOsuUsers(data.map(x => x.user_id));
        //find by user_id,beatmap_id pair
        const modded_sr_rows = await AltScoreMods.findAll({
            where: {
                user_id: data.map(x => x.user_id),
                beatmap_id: data.map(x => x.beatmap_id)
            }
        });
        for await (let score of data) {
            // add the beatmap data
            const beatmap_rows = await Databases.osuAlt.query(`
                SELECT * FROM beatmaps 
                WHERE beatmap_id = ${score.beatmap_id}`);
            score.beatmap = beatmap_rows[0]?.[0];

            if (score.beatmap) {
                // add the modded stars data
                const modded_sr_rows = await Databases.osuAlt.query(`
                SELECT * FROM moddedsr 
                WHERE beatmap_id = ${score.beatmap_id} 
                AND mods_enum = ${CorrectedSqlScoreModsCustom(score.enabled_mods)}`);
                score.beatmap.modded_sr = modded_sr_rows[0]?.[0];
                if (score.beatmap.modded_sr !== undefined) {
                    score.beatmap.modded_sr['live'] = JSON.parse(JSON.stringify(modded_sr_rows[0]?.[0]));
                }
            }

            if (users) {
                users.forEach(osu_user => {
                    if (osu_user.id == score.user_id) {
                        score.user = osu_user;
                    }
                });
            }

            const modded_sr = modded_sr_rows.find(x => x.user_id == score.user_id && x.beatmap_id == score.beatmap_id);
            if(modded_sr){
                score.modern_mods = modded_sr.dataValues;
            }
        }

        data = await ApplyDifficultyData(data);
        //remove scores that dont have a user
        data = data.filter(x => x.user);
        //limit to the requested amount
        data = data.slice(0, limit);
    } catch (err) {
        console.log(err);
        throw new Error(err.message);
    }
    return data;
}

module.exports.GetBeatmaps = GetBeatmaps;
async function GetBeatmaps(config) {
    let whereClause = {
        mode: { [Op.in]: config.mode ? config.mode.split(',') : [0] },
        approved: { [Op.in]: config.approved ? config.approved.split(',') : [1, 2, ...(config.include_qualified ? [3] : []), ...(config.include_loved ? [4] : [])] },
        stars: { [Op.between]: [config.stars_min ?? 0, config.stars_max ?? 100000] },
        ar: { [Op.between]: [config.ar_min ?? 0, config.ar_max ?? 100000] },
        od: { [Op.between]: [config.od_min ?? 0, config.od_max ?? 100000] },
        cs: { [Op.between]: [config.cs_min ?? 0, config.cs_max ?? 100000] },
        hp: { [Op.between]: [config.hp_min ?? 0, config.hp_max ?? 100000] },
        length: { [Op.between]: [config.length_min ?? 0, config.length_max ?? 100000] }
    }

    if (config.isSetID && config.id) {
        whereClause.set_id = { [Op.in]: Array.isArray(config.id) ? config.id : config.id.split(',') };
    } else {
        whereClause.beatmap_id = { [Op.and]: [] };
        if (config.id) {
            // whereClause.beatmap_id = { [Op.in]: config.id.split(',') };
            whereClause.beatmap_id[Op.and].push({ [Op.in]: Array.isArray(config.id) ? config.id : config.id.split(',') });
        }
        if (config.pack) {
            //whereClause.pack_id = { [Op.in]: config.pack.split(',') };
            whereClause.beatmap_id[Op.and].push({
                [Op.in]:
                    Sequelize.literal(`
                        (
                            select beatmap_id from beatmap_packs 
                            where 
                            beatmap_packs.beatmap_id = beatmap_id and 
                            beatmap_packs.pack_id in ('${config.pack}'))`)
            });
        }
    }

    const beatmaps = await AltBeatmap.findAll({
        where: whereClause,
        limit: config.limit ?? undefined,
        offset: config.offset ?? 0,
        ...(
            config.isSetID ? {
                group: ['beatmap_id', 'set_id'],
            } : {}
        )
    });

    return beatmaps;
}

module.exports.GetBeatmapScores = GetBeatmapScores;
async function GetBeatmapScores(beatmap_id, limit = 0, offset = 0) {
    let data;
    try {
        const rows = await Databases.osuAlt.query(`
            SELECT * FROM scores
            WHERE beatmap_id = ${beatmap_id} AND user_id in (select user_id from users2)
            ORDER BY score DESC
            ${limit !== undefined && limit > 0 ? `LIMIT ${limit}` : ''}
            ${offset !== undefined && offset > 0 ? `OFFSET ${offset}` : ''}
            `);
        let scores = rows?.[0];

        const user_ids = scores.map(x => x.user_id);
        let users = await AltUser.findAll({
            attributes: ['user_id', 'username', 'country_code'],
            where: { user_id: user_ids }
        });

        const inspector_users = await InspectorUser.findAll({
            where: { osu_id: user_ids },
            include: [
                {
                    model: InspectorClanMember,
                    attributes: ['osu_id', 'clan_id', 'join_date', 'pending'],
                    as: 'clan_member',
                    include: [{
                        model: InspectorClan,
                        attributes: ['id', 'name', 'tag', 'color', 'creation_date', 'description', 'owner'],
                        as: 'clan',
                    }]
                }
            ]
        });

        for await (let score of scores) {
            score.user = {};
            let user = users.find(x => x.user_id == score.user_id);
            let inspector_user = inspector_users.find(x => x.osu_id == score.user_id);
            if (user) {
                score.user = JSON.parse(JSON.stringify(user));
            } else {
                score.user = {
                    id: null,
                    osu_id: score.user_id,
                    country_code: null
                }
            }

            score.user.inspector_user = {};

            if (inspector_user) {
                score.user.inspector_user = inspector_user;
            } else {
                //generate a new inspector user
                score.user.inspector_user = {
                    id: null,
                    osu_id: score.user_id,
                    known_username: score.user.username,
                    roles: []
                }
            }
        };

        data = scores;
        //data = rows;
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}

module.exports.GetSystemInfo = GetSystemInfo;
async function GetSystemInfo() {
    let data;
    try {
        const _data = await InspectorScoreStat.findOne({
            where: {
                key: 'system_info',
                period: 'any'
            }
        });

        data = JSON.parse(_data.value);
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}

module.exports.GetPopulation = GetPopulation;
async function GetPopulation() {
    let data;
    try {
        const rows = await AltUser.findAll({
            attributes: ['country_code', 'country_name', [Sequelize.fn('COUNT', Sequelize.col('country_code')), 'count']],
            group: ['country_code', 'country_name'],
            order: [[Sequelize.col('count'), 'DESC']]
        });
        data = rows;
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}