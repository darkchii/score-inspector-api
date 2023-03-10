var express = require('express');
var apicache = require('apicache');
var router = express.Router();
const { Client } = require('pg');
const { GetBestScores, score_columns, score_columns_full, beatmap_columns } = require('../helpers/osualt');
const rateLimit = require('express-rate-limit');
const { getBeatmaps, getCompletionData } = require('../helpers/inspector');
const { AltScore, AltBeatmap, AltModdedStars, AltBeatmapPack, InspectorModdedStars } = require('../helpers/db');
const { Op, Sequelize } = require('sequelize');
const { CorrectedSqlScoreMods, CorrectMod, ModsToString } = require('../helpers/misc');
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
    const scores = await AltScore.findAll({
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
                include: include_modded ? [
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
                    }
                ] : [],
            },
        ],
        raw: true,
        nest: true
    });

    if (include_modded) {
        //const beatmap_mod_pair = scores.map(score => { return { beatmap_id: score.beatmap_id, mods: score.enabled_mods } });
        const beatmap_ids = scores.map(score => score.beatmap_id);
        const per_fetch = 500;
        let modded_stars_cache = {};
        let unique_versions = [];
        for (let i = 0; i < beatmap_ids.length; i += per_fetch) {
            const modded_stars = await InspectorModdedStars.findAll({
                where: {
                    beatmap_id: {
                        [Op.in]: beatmap_ids
                    }
                },
                limit: per_fetch,
                offset: i,
                raw: true,
                nest: true
            });
            modded_stars.forEach(modded_star => {
                if (!unique_versions.includes(modded_star.version)) {
                    unique_versions.push(modded_star.version);
                }
                modded_stars_cache[`${modded_star.beatmap_id}-${modded_star.mods}-${modded_star.version}`] = modded_star;
            });
        }

        for (const score of scores) {
            const int_mods = parseInt(score.enabled_mods);
            const correct_mods = CorrectMod(int_mods);
            unique_versions.forEach(version => {
                if (score.beatmap.modded_sr === undefined) {
                    score.beatmap.modded_sr = {};
                }
                const sr = modded_stars_cache[`${score.beatmap_id}-${correct_mods}-${version}`];
                if (sr) {
                    score.beatmap.modded_sr[version] = sr;
                }
            });
        };
    }


    console.log(`[Scores] Fetched ${scores.length} scores for user ${req.params.id} (include_loved: ${req.query.include_loved}, ignored modded starrating: ${req.query.ignore_modded_stars === 'true'})`);

    return scores;
}

/* Get the entire list of scores of a user */
router.get('/user/:id', limiter, cache('1 hour'), async function (req, res, next) {
    const rows = await GetUserScores(req);
    res.json(rows);
});

router.get('/completion/:id', limiter, cache('1 hour'), async function (req, res, next) {
    req.query.ignore_modded_stars = 'true';
    console.time('GetUserScores');
    const scores = await GetUserScores(req, ['beatmap_id'], ['beatmap_id', 'approved_date', 'length', 'stars', 'cs', 'ar', 'od', 'hp', 'approved']);
    console.timeEnd('GetUserScores');

    const beatmaps = await getBeatmaps({ ...req.query, customAttributeSet: [
        'beatmap_id',
        'cs',
        'ar',
        'od',
        'hp',
        'approved_date',
        'star_rating',
        'total_length'
    ] });

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
    '24h', 'all'
]
router.get('/stats', limiter, cache('1 hour'), async function (req, res, next) {
    //stats from today
    const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
    await client.connect();
    const approved_query = `(beatmaps.approved = 1 OR beatmaps.approved = 2 OR beatmaps.approved = 4)`;
    const join_query = `
    LEFT JOIN beatmaps ON scores.beatmap_id = beatmaps.beatmap_id 
    INNER JOIN users2 ON scores.user_id = users2.user_id
    `;
    const full_query = `SELECT 
        count(*) as scores, 
        sum(score) as total_score,
        sum(case when scores.pp = 'NaN' then 0 else scores.pp end) as total_pp,
        max(case when scores.pp = 'NaN' then 0 else scores.pp end) as max_pp,
        sum(length) as total_length,
        count(*) FILTER (WHERE rank = 'XH') as scores_xh,
        count(*) FILTER (WHERE rank = 'X') as scores_x,
        count(*) FILTER (WHERE rank = 'SH') as scores_sh,
        count(*) FILTER (WHERE rank = 'S') as scores_s,
        count(*) FILTER (WHERE rank = 'A') as scores_a,
        count(*) FILTER (WHERE rank = 'B') as scores_b,
        count(*) FILTER (WHERE rank = 'C') as scores_c,
        count(*) FILTER (WHERE rank = 'D') as scores_d,
        sum(count300+count100+count50) as total_hits
    FROM scores 
    ${join_query} 
    WHERE ${approved_query}`;

    let _res = {};
    for await (const period of STAT_PERIODS) {
        let time_query = '';
        if (period === '24h') {
            time_query = 'AND (date_played BETWEEN NOW() - INTERVAL \'24 HOURS\' AND NOW())';
        } else if (period === '7d') {
            time_query = 'AND (date_played BETWEEN NOW() - INTERVAL \'7 DAYS\' AND NOW())';
        }
        const { rows } = await client.query(`${full_query} ${time_query}`);

        const most_played_map_columns = beatmap_columns;
        const { rows: most_played_map } = await client.query(`SELECT count(*), ${most_played_map_columns} FROM scores ${join_query} WHERE ${approved_query} ${time_query} GROUP BY ${most_played_map_columns} ORDER BY count(*) DESC LIMIT 1`);
        let data = rows[0];
        data.most_played_map = most_played_map[0];
        _res[period] = data;
    }

    await client.end();
    res.json(_res);
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

module.exports = router;
