var express = require('express');
var apicache = require('apicache');
var router = express.Router();
const { Client } = require('pg');
const { GetBestScores, score_columns, score_columns_full, beatmap_columns } = require('../helpers/osualt');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const limiter = rateLimit({
	windowMs: 60 * 1000, // 15 minutes
	max: 60, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

let cache = apicache.middleware;

/* Get the entire list of scores of a user */
router.get('/user/:id', limiter, cache('1 hour'), async function (req, res, next) {
    const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
    await client.connect();
    const approved_query = `AND (beatmaps.approved = 1 OR beatmaps.approved = 2 ${req.query.loved === 'true' ? 'OR beatmaps.approved = 4' : ''})`;
    const { rows } = await client.query(`
        SELECT ${score_columns_full}, users2.username FROM scores 
        LEFT JOIN beatmaps ON scores.beatmap_id = beatmaps.beatmap_id 
        LEFT JOIN moddedsr on beatmaps.beatmap_id = moddedsr.beatmap_id and moddedsr.mods_enum = (case when is_ht = 'true' then 256 else 0 end + case when is_dt = 'true' then 64 else 0 end + case when is_hr = 'true' then 16 else 0 end + case when is_ez = 'true' then 2 else 0 end + case when is_fl = 'true' then 1024 else 0 end) 
        LEFT join (select beatmap_id, STRING_AGG(pack_id, ',') as pack_id from beatmap_packs group by beatmap_id) bp on beatmaps.beatmap_id = bp.beatmap_id 
        INNER JOIN users2 ON scores.user_id = users2.user_id 
        WHERE scores.user_id=$1 ${approved_query}`, [req.params.id]);
    await client.end();
    res.json(rows);
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
