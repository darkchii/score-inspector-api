var express = require('express');
var apicache = require('apicache');
var router = express.Router();
const { Client } = require('pg');
const rateLimit = require('express-rate-limit');
const { GetUsers } = require('../helpers/osu');
const { HasScores } = require('../helpers/osualt');
const { GetBeatmapCount, getBeatmaps } = require('../helpers/inspector');
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

async function checkTables(stat, tableType, fullFilter = null, isBeatmapResult = false, country = false, scoreFilter = null, userFilter = null, beatmapQuery = null, groupSets = false) {
    const base = `
    (
        select 
        ${isBeatmapResult ?
            `${groupSets ? 'beatmaps.set_id' : 'beatmaps.beatmap_id'}, beatmaps.mode, beatmaps.approved` :
            `users2.user_id, users2.username`}
            ${country && !groupSets ? ', country_code' : ''}, 
            ${tableType === 'array_table' ? (beatmapQuery !== null ? beatmapQuery : 'count(*)') : stat} as stat
        ${!isBeatmapResult && tableType === 'scores' ? `
            FROM scores 
            INNER JOIN beatmaps ON scores.beatmap_id = beatmaps.beatmap_id 
            INNER JOIN users2 ON scores.user_id = users2.user_id` : ``}
        ${!isBeatmapResult && tableType === 'user' ? `
            FROM users2` : ``}
        ${tableType === 'array_table' ? `
            FROM ${stat} 
            ${groupSets ? '' :
                `${scoreFilter || isBeatmapResult ? `INNER JOIN scores ON (scores.beatmap_id = ${stat}.beatmap_id ${scoreFilter !== null ? `AND ${scoreFilter}` : ''})` : ''}
                INNER JOIN users2 ON (${scoreFilter || isBeatmapResult ? 'scores' : stat}.user_id = users2.user_id ${userFilter !== null ? `AND ${userFilter}` : ''})`
            }
            ${fullFilter !== null ? `WHERE ${fullFilter}` : ''}`
            : ``}
      GROUP BY 
          ${isBeatmapResult ?
            `${(groupSets ? 'beatmaps.set_id' : 'beatmaps.beatmap_id')}, beatmaps.mode, beatmaps.approved, beatmaps.approved_date, beatmaps.submit_date` :
            'users2.user_id'}
          ${country && !groupSets ? ', country_code' : ''}
      ) base
    `;
    return base;
}

const FC_FILTER = '(countmiss = 0 and (maxcombo - combo) <= scores.count100 or rank like \'%X%\')';

const STAT_DATA = {
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
    'user_badges': { query: 'user_badges', table: 'array_table', isArray: true },
    'unique_ss': { query: 'unique_ss', table: 'array_table', isArray: true },
    'unique_fc': { query: 'unique_fc', table: 'array_table', isArray: true },
    'unique_dt_fc': { query: 'unique_dt_fc', table: 'array_table', isArray: true },
    'unique_hd_ss': { query: 'unique_ss', table: 'array_table', fullFilter: 'is_hd = true', isArray: true },
    'most_played': { query: 'beatmaps', table: 'array_table', fullFilter: 'mode = 0 AND approved in (1,2,4)', isArray: false, isBeatmaps: true },
    'most_played_loved': { query: 'beatmaps', table: 'array_table', fullFilter: 'mode = 0 AND approved in (4)', isArray: false, isBeatmaps: true },
    'most_ssed': { query: 'beatmaps', table: 'array_table', fullFilter: 'mode = 0 AND approved in (1,2,4)', scoreFilter: 'accuracy=100', isArray: false, isBeatmaps: true, direction: 'asc' },
    'most_fm_ssed': { query: 'beatmaps', table: 'array_table', scoreFilter: '(is_hd = true and is_hr = true and is_dt = true and is_fl = true and accuracy=100)', fullFilter: 'mode = 0 AND approved in (1,2,4)', isArray: false, isBeatmaps: true },
    'longest_approval': { query: 'beatmaps', groupSets: true, beatmapQuery: 'age(approved_date,submit_date)', table: 'array_table', fullFilter: 'mode = 0 AND approved in (1,2)', isArray: false, isBeatmaps: true },
    'longest_maps': { query: 'beatmaps', beatmapQuery: 'length', table: 'array_table', fullFilter: 'mode = 0 AND approved in (1,2,4)', isArray: false, isBeatmaps: true },
}

async function getQueryUserData(stat, limit, offset, country) {
    let query = '';
    let queryData = [];
    let _where = '';
    let beatmapCount = (await GetBeatmapCount()) ?? 0;

    queryData = [limit, offset];
    if (country !== undefined && country !== null) {
        _where = `where country_code ILIKE $3`;
        queryData.push(country);
    }

    const _stat = parse(stat.query, beatmapCount);
    let base = await checkTables(_stat, stat.table, stat.scoreFilter ?? null, false, country !== undefined);

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
            rank, username, user_id${country !== undefined ? ', country_code' : ''}, stat
          from 
            (
              select user_id, username${country !== undefined ? ', country_code' : ''}, stat, ROW_NUMBER() over(order by stat desc) as rank 
              from ${base} ${_where}
            ) r 
          order by 
            rank 
          LIMIT 
            $1 OFFSET $2
        ) data
        `;
    return [query, queryData, 'users'];
}

async function getQueryBeatmapData(stat, limit, offset, country) {
    let query = '';
    let queryData = [];
    let _where = '';

    queryData = [limit, offset];
    if (country !== undefined && country !== null) {
        _where = `where country_code ILIKE $3`;
        queryData.push(country);
    }

    if (stat.fullFilter) {
        _where += `${_where.length === 0 ? 'where ' : ' and '}${stat.fullFilter}`;
    }

    const _stat = parse(stat.query);
    let base = await checkTables(_stat, stat.table, stat.fullFilter ?? null, true, country !== undefined, stat.scoreFilter ?? null, stat.userFilter ?? null, stat.beatmapQuery ?? null, stat.groupSets);

    query = `
          select 
            rank, ${stat.groupSets ? 'set_' : 'beatmap_'}id, stat, count(*) OVER() as total_users
          from 
            (
              select ${stat.groupSets ? 'set_' : 'beatmap_'}id, stat, ROW_NUMBER() over(order by stat desc) as rank${country !== undefined ? ', country_code' : ''}
              from ${base} ${_where}
            ) r 
          order by 
            rank ${stat.direction ?? 'asc'}
          LIMIT 
            $1 OFFSET $2
    `;

    return [query, queryData, stat.groupSets ? 'beatmapsets' : 'beatmaps'];
}

async function getQuery(stat, limit, offset, country) {
    let selectedStat = null;
    if (STAT_DATA[stat] !== undefined) {
        selectedStat = STAT_DATA[stat];
    }

    if (!selectedStat) {
        return null;
    }

    if (country?.toLowerCase() === 'world') {
        country = undefined;
    }

    if (!selectedStat.isBeatmaps) {
        return await getQueryUserData(selectedStat, limit, offset, country);
    } else {
        return await getQueryBeatmapData(selectedStat, limit, offset, country);
    }
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
    let queryInfo;
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

        queryInfo = await getQuery(stat, limit, offset, country);
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

        if (queryInfo[2] === 'users') {
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
            }
        }
        if (queryInfo[2] === 'beatmaps' || queryInfo[2] === 'beatmapsets') {
            //beatmap data
            try {
                const beatmaps = [...await getBeatmaps({ id: rows.map(row => queryInfo[2] === 'beatmaps' ? row.beatmap_id : row.set_id), include_loved: 'true', include_qualified: 'true', isSetID: queryInfo[2] === 'beatmapsets' })];
                if (beatmaps) {
                    beatmaps.forEach(osu_beatmap => {
                        const row = rows.find(row => (queryInfo[2] === 'beatmaps' ? row.beatmap_id : row.set_id) == (queryInfo[2] === 'beatmaps' ? osu_beatmap.beatmap_id : osu_beatmap.beatmapset_id));
                        row.osu_beatmap = osu_beatmap;
                    });
                }
            } catch (e) {
                console.log(e);
            }
        }

        res.json({
            result_count: total_users,
            result_type: queryInfo[2],
            leaderboard: rows
        });
    } catch (e) {
        console.error(e);
        res.json({ queryInfo: queryInfo, error: e.message });
    }
});

module.exports = router;