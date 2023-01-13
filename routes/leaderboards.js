var express = require('express');
var apicache = require('apicache');
var router = express.Router();
const { Client } = require('pg');
const rateLimit = require('express-rate-limit');
const { GetUsers } = require('../helpers/osu');
const { HasScores } = require('../helpers/osualt');
const { GetBeatmapCount } = require('../helpers/inspector');
const e = require('express');
const { parse } = require('../helpers/misc');
require('dotenv').config();
let cache = apicache.middleware;

const limiter = rateLimit({
    windowMs: 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

async function checkTables(stat, tableType, scoreFilter = null) {
    const base = `
    (
        select 
        users2.user_id, users2.username, users2.country_code, ${tableType === 'array_table' ? 'count(*)' : stat} as stat
        ${tableType === 'scores' ? `
            FROM scores 
            INNER JOIN beatmaps ON scores.beatmap_id = beatmaps.beatmap_id 
            INNER JOIN users2 ON scores.user_id = users2.user_id` : ``}
        ${tableType === 'user' ? `
            FROM users2` : ``}
        ${tableType === 'array_table' ? `
            FROM ${stat} 
            INNER JOIN scores ON (
                scores.beatmap_id = ${stat}.beatmap_id AND 
                scores.user_id = ${stat}.user_id 
                ${scoreFilter !== null ? ` AND ${scoreFilter}` : ''}
                )
            INNER JOIN users2 ON ${stat}.user_id = users2.user_id` : ``}
      GROUP BY 
          users2.user_id
      ) base
    `;
    console.log(base);

    return base;
}

const FC_FILTER = '(countmiss = 0 and (maxcombo - combo) <= scores.count100 or rank like \'%X%\')';

const STAT_DATA = { //table decides which 'check' function will be used
    'pp': { query: 'users2.pp', table: 'user' },
    'ss': { query: 'ssh_count+ss_count', table: 'user' },
    's': { query: 'sh_count+s_count', table: 'user' },
    'a': { query: 'a_count', table: 'user' },
    'b': { query: 'count(*) filter (where scores.rank = \'B\')', table: 'scores' },
    'c': { query: 'count(*) filter (where scores.rank = \'C\')', table: 'scores' },
    'd': { query: 'count(*) filter (where scores.rank = \'D\')', table: 'scores' },
    'playcount': { query: 'playcount', table: 'user' },
    'clears': { query: 'count(*)', table: 'scores' },
    'fc_clears': { query: `count(*) filter (where ${FC_FILTER})`, table: 'scores' },
    'playtime': { query: 'playtime', table: 'user' },
    'followers': { query: 'follower_count', table: 'user' },
    'replays_watched': { query: 'replays_watched', table: 'user' },
    'ranked_score': { query: 'ranked_score', table: 'user' },
    'total_score': { query: 'total_score', table: 'user' },
    'ss_score': { query: 'sum(case when scores.rank = \'X\' or scores.rank = \'XH\' then scores.score else 0 end)', table: 'scores' },
    'fc_score': { query: `sum(case when ${FC_FILTER} then scores.score else 0 end)`, table: 'scores' },
    'as_one_map': { query: 'round(pow(avg(scores.combo)*pow(avg(beatmaps.maxcombo),-1)*0.7*sum(scores.count300+scores.count100+scores.count50+scores.countmiss)+sum(scores.count300+scores.count100*0.3333+scores.count50*0.1667)*0.3,2)*36)', table: 'scores' },
    'top_score': { query: 'max(scores.score)', table: 'scores' },
    'total_hits': { query: 'total_hits', table: 'user' },
    'scores_first_count': { query: 'scores_first_count', table: 'user' },
    'post_count': { query: 'post_count', table: 'user' },
    'ranked_beatmapset_count': { query: 'ranked_beatmapset_count', table: 'user' },
    'total_pp': { query: 'sum(nullif(scores.pp, \'nan\'))', table: 'scores' },
    'top_pp': { query: 'max(nullif(scores.pp, \'nan\'))', table: 'scores' },
    'avg_pp': { query: 'avg(nullif(scores.pp, \'nan\'))', table: 'scores' },
    'avg_score': { query: 'avg(scores.score)', table: 'scores' },
    'completion': { query: '100.0/%s*count(*)', table: 'scores' },
    'avg_acc': { query: 'avg(nullif(scores.accuracy, \'nan\'))', table: 'scores' },
    'acc': { query: 'hit_accuracy', table: 'user' },
    'user_achievements': { query: 'user_achievements', table: 'array_table', isArray: true },
    'user_medals': { query: 'user_badges', table: 'array_table', isArray: true },
    'unique_ss': { query: 'unique_ss', table: 'array_table', isArray: true },
    'unique_fc': { query: 'unique_fc', table: 'array_table', isArray: true },
    'unique_dt_fc': { query: 'unique_dt_fc', table: 'array_table', isArray: true },
    'unique_hd_ss': { query: 'unique_ss', table: 'array_table', scoreFilter: 'is_hd = true', isArray: true },
}

async function getQuery(stat, limit, offset, country) {
    let selectedStat = null;
    let query = '';
    let queryData = [];
    let _where = '';
    let beatmapCount = (await GetBeatmapCount()) ?? 0;

    queryData = [limit, offset];
    if (country !== undefined && country !== null) {
        _where = `where country_code ILIKE $3`;
        queryData.push(country);
    }

    if (STAT_DATA[stat] !== undefined) {
        selectedStat = STAT_DATA[stat];
    }

    if (!selectedStat) {
        return null;
    }

    const _stat = parse(selectedStat.query, beatmapCount);
    let base = await checkTables(_stat, selectedStat.table, selectedStat.scoreFilter ?? null);

    query = `
        select 
        data.*, 
        (
          select 
            count(*) 
          from 
            users2
            ${_where}
        ) as total_users 
      from 
        (
          select 
            rank, username, user_id, country_code, stat
          from 
            (
              select user_id, username, country_code, stat, ROW_NUMBER() over(order by stat desc) as rank 
              from ${base} ${_where}
            ) r 
          order by 
            rank 
          LIMIT 
            $1 OFFSET $2
        ) data
        `;

    return [query, queryData];
}

router.get('/:stat/:user_id', limiter, cache('1 hour'), async function (req, res, next) {
    try {
        let stat = req.params.stat;
        let user_id = parseInt(req.params.user_id);
        let offset = req.query.offset ? parseInt(req.query.offset) ?? 0 : 0;
        let limit = req.query.limit ? parseInt(req.query.limit) ?? 100 : 100;
        if (limit > 100) limit = 100;
        if (offset < 0) offset = 0;
        offset = offset * limit;
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();
        const queryInfo = getQuery(stat, limit, offset, null, user_id);
        let { rows } = await client.query(queryInfo[0], queryInfo[1]);
        await client.end();

        res.json(rows);
    } catch (e) {
        res.json({ error: e.message });
    }
});

router.get('/:stat', limiter, cache('1 hour'), async function (req, res, next) {
    try {
        let stat = req.params.stat;
        let country = req.query.country;
        let offset = req.query.offset ? parseInt(req.query.offset) ?? 0 : 0;
        let limit = req.query.limit ? parseInt(req.query.limit) ?? 100 : 100;
        if (limit > 100) limit = 100;
        if (offset < 0) offset = 0;
        offset = offset * limit;
        const client = new Client({ query_timeout: 30000, user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();

        const queryInfo = await getQuery(stat, limit, offset, country);
        if (!queryInfo) {
            res.status(400).send('Invalid stat');
            return;
        }

        const { rows } = await client.query(queryInfo[0], queryInfo[1]);

        const total_users = rows[0]?.total_users ?? 0;
        rows.forEach(row => {
            row.total_users = undefined;
        });
        await client.end();

        try {
            const { users } = await GetUsers(rows.map(row => row.user_id));
            if (users) {
                users.forEach(osu_user => {
                    const row = rows.find(row => row.user_id === osu_user.id);
                    row.osu_user = osu_user;
                });
            }
        } catch (e) {
            console.log(e);
            res.json({ error: e });
        }

        res.json({
            result_users: total_users,
            leaderboard: rows
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

module.exports = router;