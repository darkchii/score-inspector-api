var express = require('express');
var router = express.Router();
const { Client } = require('pg');
require('dotenv').config();

function getQuery(stat, limit, offset, country, user_id) {
    let query = '';
    let _stat = 'ssh_count+ss_count';
    let _country = '';

    let queryData = [];

    switch (stat) {
        case 'pp': _stat = 'pp'; break;
        case 'ss': _stat = 'ssh_count+ss_count'; break;
        case 's': _stat = 'sh_count+s_count'; break;
        case 'a': _stat = 'a_count'; break;
        case 'playcount': _stat = 'playcount'; break;
        case 'clears': _stat = 'ssh_count+ss_count+sh_count+s_count+a_count'; break;
        case 'playtime': _stat = 'playtime'; break;
        case 'followers': _stat = 'follower_count'; break;
        case 'replays_watched': _stat = 'replays_watched'; break;
        case 'ranked_score': _stat = 'ranked_score'; break;
        case 'total_score': _stat = 'total_score'; break;
        case 'total_hits': _stat = 'total_hits'; break;
        case 'scores_first_count': _stat = 'scores_first_count'; break;
        case 'post_count': _stat = 'post_count'; break;
        case 'ranked_beatmapset_count': _stat = 'ranked_beatmapset_count'; break;
    }

    const requiredFields = 'user_id, username, country_code'
    if (user_id !== undefined) {
        query = `select * from (select ${requiredFields}, stat, ROW_NUMBER() OVER (order by stat desc) as rank from (select ${requiredFields}, ${_stat} as stat from users2) base) r where user_id = $1`;
        queryData = [user_id];
    } else {
        let _where = '';

        queryData = [limit, offset];
        if (country !== undefined && country !== null) {
            _where = `where country_code ILIKE $3`;
            queryData.push(country);
        }

        query = `select data.*, (select count(*) from users2 ${_where}) as total_users from (select rank, ${requiredFields}, tracked, stat from (select ${requiredFields}, tracked, stat, ROW_NUMBER() OVER(order by stat desc) as rank from (select ${requiredFields}, (select count(*)>0 from priorityuser where priorityuser.user_id = users2.user_id) as tracked, ${_stat} as stat from users2) base) r order by rank) data ${_where} limit $1 offset $2;`
    }

    return [query, queryData];
}

router.get('/:stat/:user_id', async function (req, res, next) {
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

router.get('/:stat', async function (req, res, next) {
    try {
        let stat = req.params.stat;
        let country = req.query.country;
        let offset = req.query.offset ? parseInt(req.query.offset) ?? 0 : 0;
        let limit = req.query.limit ? parseInt(req.query.limit) ?? 100 : 100;
        if (limit > 100) limit = 100;
        if (offset < 0) offset = 0;
        offset = offset * limit;
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();

        const queryInfo = getQuery(stat, limit, offset, country);

        const { rows } = await client.query(queryInfo[0], queryInfo[1]);

        const total_users = rows[0]?.total_users ?? 0;
        rows.forEach(row => {
            row.total_users = undefined;
        });

        await client.end();
        res.json({
            result_users: total_users,
            leaderboard: rows
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

module.exports = router;