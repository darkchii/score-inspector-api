var express = require('express');
var apicache = require('apicache');
var router = express.Router();
const { Client } = require('pg');
const { GetBestScores, score_columns, score_columns_full, beatmap_columns, GetBeatmapScores } = require('../../helpers/osualt');
const rateLimit = require('express-rate-limit');
const { getBeatmaps, getCompletionData, DefaultInspectorUser } = require('../../helpers/inspector');
const { AltScore, AltBeatmap, AltModdedStars, AltBeatmapPack, InspectorModdedStars, InspectorScoreStat, AltBeatmapEyup, Databases, AltBeatmapSSRatio, AltTopScore, InspectorHistoricalScoreRank, InspectorUser, InspectorRole, InspectorUserMilestone, InspectorOsuUser } = require('../../helpers/db');
const { Op, Sequelize } = require('sequelize');
const { CorrectedSqlScoreMods, CorrectMod, ModsToString, db_now } = require('../../helpers/misc');
const request = require("supertest");
const { GetOsuUsers } = require('../../helpers/osu');
require('dotenv').config();

const limiter = rateLimit({
    windowMs: 60 * 1000, // 15 minutes
    max: 60, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

let cache = apicache.middleware;

async function GetUserScores(req, score_attributes = undefined, beatmap_attributes = undefined) {
    const include_modded = req.query.ignore_modded_stars !== 'true';
    let scores = await AltScore.findAll({
        attributes: score_attributes,
        where: {
            user_id: req.params.id
        },
        order: [
            [req.query.order ?? 'pp', req.query.dir ?? 'DESC']
        ],
        limit: req.query.limit ?? undefined,
        include: [
            {
                attributes: beatmap_attributes,
                model: AltBeatmap,
                as: 'beatmap',
                where: {
                    approved: { [Op.in]: [1, 2, req.query.include_loved === 'true' ? 4 : 1] }
                },
                required: true,
                include: [
                    ...(include_modded ? [
                        {
                            model: AltModdedStars,
                            as: 'modded_sr',
                            where: {
                                mods_enum: {
                                    [Op.eq]: Sequelize.literal(CorrectedSqlScoreMods)
                                },
                                beatmap_id: {
                                    [Op.eq]: Sequelize.literal('beatmap.beatmap_id')
                                }
                            }
                        }] : []),
                    {
                        model: AltBeatmapEyup,
                        as: 'eyup_sr',
                        required: false
                    },
                    {
                        model: AltBeatmapSSRatio,
                        as: 'ss_ratio',
                        required: false
                    },
                    //get all beatmap packs by beatmap_id in one query as an array
                    // {
                    //     model: AltBeatmapPack,
                    //     as: 'packs',
                    //     required: false,
                    // }
                ],
            },
            {
                model: AltTopScore,
                as: 'top_score',
                where: {
                    user_id: req.params.id
                },
                required: false,
            }
        ],
        nest: true
    });

    scores = JSON.parse(JSON.stringify(scores));

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
    for (const score of scores) {
        score.beatmap.packs = beatmap_packs.filter(pack => pack.beatmap_id === score.beatmap_id);
    }

    if (include_modded) {
        const query_prepare = [];

        console.time('modded_stars prep')
        for (const score of scores) {
            const int_mods = parseInt(score.enabled_mods);
            const correct_mods = CorrectMod(int_mods);
            // query_prepare.push(`(beatmap_id = ${score.beatmap_id} AND mods = ${correct_mods})`);
            query_prepare.push({
                beatmap_id: score.beatmap_id,
                mods: correct_mods
            })
        }
        console.timeEnd('modded_stars prep')

        console.time('modded_stars query')
        // const modded_stars = await InspectorModdedStars.findAll({
        //     where: {
        //         [Op.or]: query_prepare
        //     },
        //     raw: true,
        //     nest: true
        // });
        // do per 100
        let promises = [];
        for (let i = 0; i < query_prepare.length; i += 100) {
            const query = query_prepare.slice(i, i + 100);
            promises.push(InspectorModdedStars.findAll({
                where: {
                    [Op.or]: query
                },
                raw: true,
                nest: true
            }));
        }
        const _modded_stars = await Promise.all(promises);
        let modded_stars = {};
        _modded_stars[0].forEach(_stars => {
            // modded_stars.push(..._stars);
            if(!modded_stars[_stars.beatmap_id]){
                modded_stars[_stars.beatmap_id] = [];
            }

            modded_stars[_stars.beatmap_id].push(_stars);
        });
        // console.log(modded_stars);
        console.timeEnd('modded_stars query')

        console.time('modded_stars assign')
        for (const score of scores) {
            const modded_srs = modded_stars[score.beatmap_id] ?? [];
            if(modded_srs.length > 0){
                for (const modded_sr of modded_srs) {
                    let version = modded_sr.version;
    
                    if (score.beatmap.modded_sr === undefined) {
                        score.beatmap.modded_sr = {};
                    }
    
                    score.beatmap.modded_sr[version] = modded_sr;
                }
            }
        }
        console.timeEnd('modded_stars assign')
    }

    if (scores && scores.length > 0) {
        if (beatmap_set_ids.length > 0 && beatmap_ids.length > 0) {
            const _max_pc = await Databases.osuAlt.query(`
                SELECT set_id, mode, MAX(playcount) AS max_playcount FROM beatmaps
                WHERE set_id IN (${beatmap_set_ids.join(',')})
                GROUP BY set_id, mode
            `);

            let max_pc = _max_pc?.[0];

            for (const score of scores) {
                const max_pc_beatmap_index = max_pc?.findIndex(b => b.set_id === score.beatmap.set_id && b.mode === score.beatmap.mode);
                const max_pc_beatmap = max_pc?.[max_pc_beatmap_index];

                //remove the index if found
                if (max_pc_beatmap_index !== -1) {
                    max_pc.splice(max_pc_beatmap_index, 1);
                }

                if (max_pc_beatmap && score.beatmap?.eyup_sr) {
                    score.beatmap.eyup_sr.max_playcount = max_pc_beatmap.max_playcount;
                }

                // if (pack_ids_beatmap && pack_ids_beatmap.length > 0) {
                //     score.beatmap.packs = pack_ids_beatmap;
                // }
            }
        }
    }
    return [];
    // return scores;
}

/* Get the entire list of scores of a user */
router.get('/user/:id', limiter, cache('1 hour'), async function (req, res, next) {
    const rows = await GetUserScores(req);
    res.json(rows);
});

/* Get the entire list of scores of a beatmap */
router.get('/beatmap/:id', limiter, cache('1 hour'), async function (req, res, next) {
    const beatmap_id = req.params.id;
    const limit = req.query.limit ?? undefined;
    const offset = req.query.offset ?? undefined;
    const rows = await GetBeatmapScores(beatmap_id, limit, offset);
    res.json(rows);
});

router.get('/completion/:id', limiter, cache('1 hour'), async function (req, res, next) {
    req.query.ignore_modded_stars = 'true';
    console.time('GetUserScores');
    const scores = await GetUserScores(req, ['beatmap_id'], ['beatmap_id', 'approved_date', 'length', 'stars', 'cs', 'ar', 'od', 'hp', 'approved']);
    console.timeEnd('GetUserScores');

    const beatmaps = await getBeatmaps({
        ...req.query, customAttributeSet: [
            'beatmap_id',
            'cs',
            'ar',
            'od',
            'hp',
            'approved_date',
            'star_rating',
            'total_length'
        ]
    });

    console.time('getCompletionData');
    const data = getCompletionData(scores, beatmaps);
    console.timeEnd('getCompletionData');

    res.json(data);
});

const valid_periods = ['all', 'year', 'month', 'week', 'day'];
const valid_stats = ['pp', 'score'];
router.get('/best', limiter, cache('1 hour'), async function (req, res, next) {
    const period = req.query.period || 'all';
    const stat = req.query.stat || 'pp';
    const limit = req.query.limit || 5;
    const loved = req.query.loved ? true : false;
    if (!valid_periods.includes(period)) {
        res.status(400).json({ "error": "Invalid period" });
        return;
    }
    if (!valid_stats.includes(stat)) {
        res.status(400).json({ "error": "Invalid stat" });
        return;
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
        res.status(400).json({ "error": "Invalid limit" });
        return;
    }

    let scores;
    try {
        scores = await GetBestScores(period, stat, limit, loved);
    } catch (e) {
        res.status(500).json({ "error": "Error while fetching scores" });
        return;
    }

    res.json(scores);
});

const STAT_PERIODS = [
    '30min', '24h', '7d', 'all'
]

router.get('/stats', limiter, async function (req, res, next) {
    //stats from today
    let data = {};
    for await (const period of STAT_PERIODS) {
        const rows = await InspectorScoreStat.findAll({
            where: {
                period: period
            },
            raw: true,
            nest: true
        });

        data[period] = {};
        rows.forEach(row => {
            try {
                data[period][row.key] = JSON.parse(row.value);
            } catch (e) {
                data[period][row.key] = row.value;
            }
        });
    }

    const pp_distribution = JSON.parse((await InspectorScoreStat.findOne({
        where: {
            key: 'pp_distribution',
            period: 'misc'
        },
        raw: true,
        nest: true
    }))?.value);

    if (pp_distribution) {
        const user_ids = pp_distribution.map(row => row.most_common_user_id);
        //new set of unique user ids excluding nulls
        // let unique_user_ids = [...new Set(user_ids)];
        const unique_user_ids = user_ids.filter(id => id);

        const client = request(req.app);
        const users = await client.get(`/users/full/${unique_user_ids.join(',')}?force_array=false&skipDailyData=true`).set('Origin', req.headers.origin || req.headers.host);

        pp_distribution.forEach(row => {
            const user = users.body.find(user => user.osu.id === row.most_common_user_id);
            row.most_common_user = user;
        });
    }

    data.pp_distribution = pp_distribution ?? [];

    res.json(data);
});

router.get('/most_played', limiter, cache('1 hour'), async function (req, res, next) {
    const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
    await client.connect();

    const limit = req.params.limit || 10;
    const offset = req.params.offset || 0;

    const query = `
        SELECT t.* FROM 
        (
            SELECT count(*), beatmaps.* 
            FROM scores LEFT JOIN beatmaps ON scores.beatmap_id = beatmaps.beatmap_id 
            WHERE (beatmaps.approved = 1 OR beatmaps.approved = 2 OR beatmaps.approved = 4) 
            GROUP BY beatmaps.beatmap_id 
            ORDER BY count(*) DESC
        ) as t 
        LIMIT ${limit} 
        OFFSET ${offset}`;

    const { rows } = await client.query(query);
    await client.end();
    res.json(rows);
});

router.get('/activity', limiter, cache('20 minutes'), async function (req, res, next) {
    const hours = req.query.hours || 24;
    const query = `WITH hour_entries AS (
        SELECT generate_series(date_trunc('hour', ${db_now} - INTERVAL '${hours} hours'), date_trunc('hour', ${db_now}), INTERVAL '1 hour') AS hour
      )
      SELECT ARRAY(
        SELECT json_build_object('timestamp', h.hour, 'entry_count', COALESCE(COUNT(s.date_played), 0)) AS entry
        FROM hour_entries h
        LEFT JOIN scores s ON date_trunc('hour', s.date_played) = h.hour
                           AND s.date_played >= ${db_now} - INTERVAL '${hours} hours'
        GROUP BY h.hour
        ORDER BY h.hour
      ) AS hour_entries;`;

    const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
    await client.connect();

    const { rows } = await client.query(query);
    await client.end();
    res.json(rows);
});

router.get('/ranking', limiter, cache('1 hour'), async function (req, res, next) {
    let user_id, date, rank = undefined;
    let limit = 100;
    let page = 0;
    let sort = 'rank'
    try {
        user_id = req.query.user_id || undefined;
        date = req.query.date || undefined;
        rank = req.query.rank || undefined;
        limit = Number(req.query.limit) || 10000;
        page = Number(req.query.page) || 1;
        sort = req.query.sort || 'rank';
    } catch (e) {
        res.status(400).json({ "error": "Invalid parameters" });
        return;
    }

    let where_clause = {};
    let sort_clause = '';
    if (user_id) { where_clause.osu_id = user_id; }
    if (date) { where_clause.date = date; }
    if (rank) { where_clause.rank = rank; }
    switch (sort) {
        default:
        case 'rank':
            sort_clause = 'rank ASC';
            break;
        case 'rank_gain':
            sort_clause = '(old_rank - rank) DESC';
            break;
        case 'score_gain':
            sort_clause = '(ranked_score - old_ranked_score) DESC';
            break;
    }

    const data = await InspectorHistoricalScoreRank.findAll({
        where: where_clause,
        order: Sequelize.literal(sort_clause),
        limit: limit,
        offset: (page - 1) * limit,
        raw: true,
        nest: true
    });

    if (where_clause.date) {
        //we also want to add the rank of the user in the previous day
        try {
            data.forEach(row => {
                row.inspector_user = {
                    known_username: row.username,
                    osu_id: row.osu_id,
                    roles: [],
                };
            });

            const osuUsers = await GetOsuUsers(data.map(row => row.osu_id));

            console.log(osuUsers);

            const inspectorUsers = await InspectorUser.findAll({
                where: { osu_id: data.map(row => row.osu_id) },
                include: [
                    {
                        model: InspectorRole,
                        attributes: ['id', 'title', 'description', 'color', 'icon', 'is_visible', 'is_admin', 'is_listed'],
                        through: { attributes: [] },
                        as: 'roles'
                    }
                ]
            });

            if (osuUsers && inspectorUsers) {
                osuUsers.forEach(osu_user => {
                    const row = data.find(row => row.osu_id === osu_user.id);
                    row.osu_user = osu_user;
                });
            }

            if (inspectorUsers) {
                inspectorUsers.forEach(inspector_user => {
                    const row = data.find(row => row.osu_id === inspector_user.osu_id);
                    row.inspector_user = inspector_user;
                });
            }
        } catch (e) {
            console.error(e);
        }
    }


    console.log(data.length);
    res.json(data);
});

router.get('/ranking/dates', limiter, cache('1 hour'), async function (req, res, next) {
    try {
        const data = await InspectorHistoricalScoreRank.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('date')), 'date']],
            raw: true,
            nest: true
        });

        let dates = [];
        data.forEach(row => {
            dates.push(row.date);
        });

        res.json(dates);
    } catch (e) {
        console.error(e);

        res.json([])
    }
});

router.get('/ranking/stats', limiter, cache('1 hour'), async function (req, res, next) {
    let daily_total_ranked_score;
    try {
        //get the total ranked score of each unique day
        daily_total_ranked_score = await InspectorHistoricalScoreRank.findAll({
            attributes: [
                'date',
                [Sequelize.fn('SUM', Sequelize.col('ranked_score')), 'total_ranked_score']
            ],
            group: ['date'],
            raw: true,
            nest: true
        });
    } catch (e) {
        console.error(e);
    }

    res.json({
        daily_total_ranked_score: daily_total_ranked_score ?? []
    });
});

router.get('/milestones/user/:id', limiter, cache('1 hour'), async function (req, res, next) {
    const user_id = req.params.id;
    const limit = req.query.limit || 10;
    const offset = req.query.offset || 0;

    const milestones = await InspectorUserMilestone.findAll({
        where: {
            user_id: user_id
        },
        order: [
            ['time', 'DESC']
        ],
        limit: limit,
        offset: offset,
        raw: true,
        nest: true,
        include: [
            {
                model: InspectorOsuUser,
                as: 'user',
                required: true
            }, {
                model: InspectorUser,
                as: 'inspector_user'
            }
        ]
    });
    res.json(milestones);
});

router.get('/milestones', limiter, cache('1 hour'), async function (req, res, next) {
    let limit = 100;
    let page = 0;
    try {
        limit = Number(req.query.limit) || 10000;
        page = Number(req.query.page) || 1;
    } catch (e) {
        res.status(400).json({ "error": "Invalid parameters" });
        return;
    }

    const milestones = await InspectorUserMilestone.findAll({
        order: [
            ['time', 'DESC']
        ],
        limit: limit,
        offset: (page - 1) * limit,
        raw: true,
        nest: true,
        include: [
            {
                model: InspectorOsuUser,
                as: 'user',
                required: true
            }, {
                model: InspectorUser,
                as: 'inspector_user'
            }
        ]
    });

    // milestones.forEach(milestone => {
    //     milestone.inspector_user = DefaultInspectorUser(milestone.inspector_user, milestone.user.username, milestone.user.user_id);
    // });
    for (const milestone of milestones) {
        milestone.inspector_user = DefaultInspectorUser(milestone.inspector_user, milestone.user.username, milestone.user.user_id);
    }

    res.json(milestones);
});

router.get('/milestones/count', limiter, cache('1 hour'), async function (req, res, next) {
    const count = await InspectorUserMilestone.count();
    res.json(count);
});

router.get('/milestones/stats', limiter, cache('1 hour'), async function (req, res, next) {
    let recorded_milestones, recorded_milestones_today, users;
    try {
        recorded_milestones = await InspectorUserMilestone.count();
        recorded_milestones_today = await InspectorUserMilestone.count({
            where: {
                time: {
                    //mariaDB
                    [Op.gte]: Sequelize.literal(`DATE(NOW())`)
                }
            }
        });
        users = await InspectorOsuUser.count();
    } catch (err) {
        console.error(err);
    }
    res.json({
        recorded_milestones: recorded_milestones ?? 0,
        recorded_milestones_today: recorded_milestones_today ?? 0,
        users: users ?? 0
    });
});

module.exports = router;
