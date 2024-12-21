const moment = require("moment/moment");
const { Op, Sequelize, where } = require("sequelize");
const { AltPriorityUser, AltUser, AltUniqueSS, AltUniqueFC, AltUniqueDTFC, AltUserAchievement, AltScore, AltBeatmap, Databases, InspectorUser, InspectorScoreStat, InspectorClanMember, InspectorClan, InspectorOsuUser, AltScoreMods, AltModdedStars, AltTopScore, AltBeatmapPack } = require("./db");
const { CorrectedSqlScoreMods, CorrectedSqlScoreModsCustom } = require("./misc");
const { default: axios } = require("axios");
const { GetOsuUsers, ApplyDifficultyData } = require("./osu");
const { DefaultInspectorUser } = require("./user");
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
                        attributes: ['osu_id', 'clan_id', 'join_date', 'pending', 'is_moderator'],
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
            SELECT scores.*
            FROM scores
            INNER JOIN beatmaps ON scores.beatmap_id = beatmaps.beatmap_id
            WHERE ${stat} > 0 AND ${stat} IS NOT NULL AND ${stat} <> 'NaN'::NUMERIC
            ${period_check_query ? `AND ${period_check_query}` : ''}
            AND user_id in (select user_id from users2)
            AND beatmaps.approved IN (1, 2, ${loved ? 4 : 1})
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
                    attributes: ['osu_id', 'clan_id', 'join_date', 'pending', 'is_moderator'],
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

module.exports.GetScores = GetScores;
async function GetScores(req, score_attributes = undefined, beatmap_attributes = undefined) {
    const include_modded = req.query.ignore_modded_stars !== 'true';
    const _mods = req.query.mods;
    const split_mods = _mods ? _mods.split(',') : [];
    const mods_bit_values = split_mods.map(mod => all_mods_short[mod]);
    let _user_id = undefined;
    if(req.query.user_id) {
        if(Array.isArray(req.query.user_id)) {
            _user_id = req.query.user_id;
        } else {
            _user_id = [req.query.user_id];
        }
    }
    let _enabled_mods = {};
    if (req.query.mods) {
        //we do NOT correct any mods here
        //enabled_mods is a varchar in database, keep that in mind
        if (req.query.mods === 'NM') {
            _enabled_mods[Op.eq] = '0';
        } else {
            if (req.query.mods_usage === 'all') {
                //enabled_mods must contain all mods
                _enabled_mods[Op.eq] = '' + mods_bit_values.reduce((ps, a) => ps + a, 0);
            } else {
                //enabled_mods must contain any of the mods
                //Op.bitwiseAnd is not a thing, use raw sql for this
                _enabled_mods[Op.or] = mods_bit_values.map(mod => {
                    return Sequelize.literal(`(CAST("Score"."enabled_mods" AS int) & ${mod}) = ${mod}`);
                });
            }
        }
    }

    let _scores = await AltScore.findAll({
        where: {
            ..._user_id ? { user_id: { [Op.in]: _user_id } } : {},
            ...req.query.min_score || req.query.max_score ? { score: { [Op.between]: [req.query.min_score ?? 0, req.query.max_score ?? 100000000000] } } : {},
            ...req.query.min_pp || req.query.max_pp ? { pp: { [Op.between]: [req.query.min_pp ?? 0, req.query.max_pp ?? 100000000000] } } : {},
            ...req.query.min_acc || req.query.max_acc ? { accuracy: { [Op.between]: [req.query.min_acc ?? 0, req.query.max_acc ?? 101] } } : {},
            ...req.query.min_combo || req.query.max_combo ? { combo: { [Op.between]: [req.query.min_combo ?? 0, req.query.max_combo ?? 1000000000] } } : {},
            //for mods we check if enabled_mods & mod == mod, depending on mods_usage we use AND or OR, we do NOT correct the mods here
            ...req.query.mods ? {
                enabled_mods: _enabled_mods
            } : {},
            ...req.query.grades ? { rank: { [Op.in]: req.query.grades.split(',') } } : {},
            ...req.query.min_played_date || req.query.max_played_date ? { date_played: { [Op.between]: [req.query.min_played_date ?? '2000-01-01', req.query.max_played_date ?? '2100-01-01'] } } : {},
        },
        order: req.query.order ? [[req.query.order, req.query.order_dir ?? 'DESC']] : undefined,
        limit: req.query.limit ?? undefined,
        offset: req.query.offset ?? undefined,
        include: [
            {
                model: AltScoreMods,
                as: 'modern_mods',
                required: false,
                //where clause should only check if user_id matches score.user_id
                where: {
                    user_id: {
                        [Op.eq]: Sequelize.col('Score.user_id')
                    },
                    date_played: {
                        [Op.eq]: Sequelize.col('Score.date_played'),
                        [Op.eq]: Sequelize.col('date_attributes'),
                    }
                }
            },
            {
                model: AltBeatmap,
                as: 'beatmap',
                where: {
                    ...(req.query.beatmap_id ? { beatmap_id: req.query.beatmap_id } : {}),
                    ...(req.query.approved ? { [Op.or]: req.query.approved.split(',').map(approved => { return { approved: approved } }) } : {}),
                    ...(req.query.min_ar || req.query.max_ar ? { ar: { [Op.between]: [req.query.min_ar ?? 0, req.query.max_ar ?? 1000000000] } } : {}),
                    ...(req.query.min_od || req.query.max_od ? { od: { [Op.between]: [req.query.min_od ?? 0, req.query.max_od ?? 1000000000] } } : {}),
                    ...(req.query.min_hp || req.query.max_hp ? { hp: { [Op.between]: [req.query.min_hp ?? 0, req.query.max_hp ?? 1000000000] } } : {}),
                    ...(req.query.min_length || req.query.max_length ? { length: { [Op.between]: [req.query.min_length ?? 0, req.query.max_length ?? 1000000000] } } : {}),
                    //approved: { [Op.in]: [1, 2, req.query.include_loved === 'true' ? 4 : 1] },
                    ...(req.query.beatmap_id ? { beatmap_id: req.query.beatmap_id } : {}), //for development purposes
                    ...(req.query.min_approved_date || req.query.max_approved_date ? { approved_date: { [Op.between]: [req.query.min_approved_date ?? '2000-01-01', req.query.max_approved_date ?? '2100-01-01'] } } : {}),
                },
                required: true,
                include: [
                    ...(include_modded ? [
                        {
                            // required: false,
                            model: AltModdedStars,
                            as: 'modded_sr',
                            where: {
                                [Op.and]: {
                                    mods_enum: {
                                        [Op.eq]: Sequelize.literal(CorrectedSqlScoreMods)
                                    },
                                    beatmap_id: {
                                        [Op.eq]: Sequelize.literal('beatmap.beatmap_id')
                                    },
                                    ...(req.query.min_stars || req.query.max_stars ? { star_rating: { [Op.between]: [req.query.min_stars ?? 0, req.query.max_stars ?? 1000000000] } } : {}),
                                }
                            }
                        }] : [])
                ],
            },
            ...(!req.params?.id ? [{
                model: AltUser,
                as: 'user',
                required: true,
                where: {
                    ...(req.query.min_rank || req.query.max_rank ? { global_rank: { [Op.between]: [req.query.min_rank ?? 0, req.query.max_rank ?? 1000000000] } } : {}),
                    //country is comma separated, so we split it, if 'world' is in the array, we don't filter by country at all
                    //entire country code is capitalized in the database
                    ...(req.query.country && req.query.country !== 'world' ? { country_code: { [Op.or]: req.query.country.split(',').map(country => { return { [Op.iLike]: `%${country}%` } }) } } : {}),
                }
            }] : []),
        ],
        // raw: true,
        nest: true,
    });

    let scores = _scores.map(row => row.toJSON());

    //if we have modern_mods, move the contents of score.modern_mods.mods to score.mods, and remove modern_mods
    scores.forEach(score => {
        if (score.modern_mods) {
            score.mods = score.modern_mods;
            delete score.modern_mods;
        }
    });

    if (include_modded) {
        scores = await ApplyDifficultyData(scores);
    }

    if (!req.params?.id) {
        //add user data after the fact, since we don't need it in the massive query
        const inspectorUsers = await InspectorUser.findAll({
            where: { osu_id: scores.map(row => row.user_id) },
            include: [
                {
                    model: InspectorClanMember,
                    attributes: ['osu_id', 'clan_id', 'join_date', 'pending', 'is_moderator'],
                    as: 'clan_member',
                    include: [{
                        model: InspectorClan,
                        attributes: ['id', 'name', 'tag', 'color', 'creation_date', 'description', 'owner'],
                        as: 'clan',
                    }]
                }
            ]
        });

        for (let i = 0; i < scores.length; i++) {
            scores[i].inspector_user = DefaultInspectorUser(inspectorUsers.find(user => user.osu_id === scores[i].user_id), scores[i].user.username, scores[i].user_id);
        }
    }

    if (req.query.include_packs !== 'false') {
        let beatmap_set_ids = scores.map(score => score.beatmap.set_id);
        let beatmap_ids = scores.map(score => score.beatmap.beatmap_id);
        //remove duplicates and nulls
        beatmap_set_ids = [...new Set(beatmap_set_ids)].filter(id => id);
        beatmap_ids = [...new Set(beatmap_ids)].filter(id => id);

        const beatmap_packs = await AltBeatmapPack.findAll({
            where: {
                beatmap_id: {
                    [Op.in]: beatmap_ids
                }
            },
            raw: true,
            nest: true
        });

        let _beatmap_packs = {};
        beatmap_packs.forEach(pack => {
            if (!_beatmap_packs[pack.beatmap_id]) {
                _beatmap_packs[pack.beatmap_id] = [];
            }

            _beatmap_packs[pack.beatmap_id].push(pack);
        });

        for (const score of scores) {
            score.beatmap.packs = _beatmap_packs[score.beatmap_id] ?? [];
        }
    }

    return scores;
    // return [];
}