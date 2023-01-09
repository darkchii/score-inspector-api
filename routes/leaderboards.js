var express = require('express');
var apicache = require('apicache');
var router = express.Router();
const { Client } = require('pg');
const rateLimit = require('express-rate-limit');
const { GetUsers } = require('../helpers/osu');
const { HasScores } = require('../helpers/osualt');
const { GetBeatmapCount } = require('../helpers/inspector');
const e = require('express');
require('dotenv').config();
let cache = apicache.middleware;

const limiter = rateLimit({
    windowMs: 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

async function checkTables(stat) {
    let _stat = 'ssh_count+ss_count';
    let beatmapCount = (await GetBeatmapCount()) ?? 0;

    console.log(`${beatmapCount} beatmaps`);

    switch (stat) {
        case 'pp': _stat = 'users2.pp'; break;
        case 'ss': _stat = 'ssh_count+ss_count'; break;
        case 's': _stat = 'sh_count+s_count'; break;
        case 'a': _stat = 'a_count'; break;
        case 'b': _stat = 'count(*) filter (where scores.rank = \'B\')'; break;
        case 'c': _stat = 'count(*) filter (where scores.rank = \'C\')'; break;
        case 'd': _stat = 'count(*) filter (where scores.rank = \'D\')'; break;
        case 'playcount': _stat = 'playcount'; break;
        case 'clears': _stat = 'count(*)'; break;
        case 'playtime': _stat = 'playtime'; break;
        case 'followers': _stat = 'follower_count'; break;
        case 'replays_watched': _stat = 'replays_watched'; break;
        case 'ranked_score': _stat = 'ranked_score'; break;
        case 'total_score': _stat = 'total_score'; break;
        case 'top_score': _stat = 'max(scores.score)'; break;
        case 'total_hits': _stat = 'total_hits'; break;
        case 'scores_first_count': _stat = 'scores_first_count'; break;
        case 'post_count': _stat = 'post_count'; break;
        case 'ranked_beatmapset_count': _stat = 'ranked_beatmapset_count'; break;
        case 'total_pp': _stat = 'sum(nullif(scores.pp, \'nan\'))'; break;
        case 'top_pp': _stat = 'max(nullif(scores.pp, \'nan\'))'; break;
        case 'avg_pp': _stat = 'avg(nullif(scores.pp, \'nan\'))'; break;
        case 'avg_score': _stat = 'sum(scores.score)/count(*)'; break;
        case 'completion': _stat = `${beatmapCount > 0 ? `100.0/${beatmapCount}*count(*)` : `0`}`; break;
        case 'avg_acc': _stat = `avg(nullif(scores.accuracy, \'nan\'))`; break;
        case 'acc': _stat = `hit_accuracy`; break;
    }

    const base = `
    (
        select 
        users2.user_id, users2.username, users2.country_code, ${_stat} as stat
        from 
          scores 
          inner join beatmaps on scores.beatmap_id = beatmaps.beatmap_id 
          inner join users2 on scores.user_id = users2.user_id 
      GROUP BY 
          users2.user_id
      ) base
    `;

    return base;
}

async function checkArrays(table) {
    const base = `
    (
        select 
        users2.user_id, users2.username, users2.country_code, count(*) as stat
        from 
          ${table} 
          inner join users2 on ${table}.user_id = users2.user_id 
      GROUP BY 
          users2.user_id
      ) base
    `;

    return base;
}

async function getQuery(stat, limit, offset, country) {
    let query = '';
    let queryData = [];
    let _where = '';

    queryData = [limit, offset];
    if (country !== undefined && country !== null) {
        _where = `where country_code ILIKE $3`;
        queryData.push(country);
    }

    let base;

    if (stat == 'user_achievements' || stat == 'user_badges') {
        base = await checkArrays(stat);
    } else {
        base = await checkTables(stat, limit, offset);
    }

    query = `
        select 
        data.*, 
        (
          select 
            count(*) 
          from 
            users2
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