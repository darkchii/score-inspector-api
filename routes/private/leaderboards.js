var express = require('express');
var apicache = require('apicache');
var router = express.Router();
const { Client } = require('pg');
const rateLimit = require('express-rate-limit');
const { HasScores, GetBeatmaps } = require('../../helpers/osualt');
const { GetBeatmapCount } = require('../../helpers/inspector');
const e = require('express');
const { parse } = require('../../helpers/misc');
const { InspectorUser } = require('../../helpers/db');
const { GetOsuUsers } = require('../../helpers/osu');
require('dotenv').config();
let cache = apicache.middleware;

const limiter = rateLimit({
    windowMs: 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const standardized_formula = `
(
    (
        (
            pow(
                (
                    50 * scores.count50 + 100 * scores.count100 + 300 * scores.count300
                ) / (
                    300 * scores.count50 + 300 * scores.count100 + 300 * scores.count300 + 300 * scores.countmiss
                ) :: float,
                5
            ) * 500000
        ) + (
            pow(
                scores.combo / beatmaps.maxcombo :: float,
                0.75
            ) * 500000
        )
    ) * mods.multiplier * 0.96
)
`;
const object_count = '(beatmaps.circles+beatmaps.sliders+beatmaps.spinners)';
const classic_max_score = '1000000';

async function checkTables(stat, tableType, fullFilter = null, isBeatmapResult = false, country = false, scoreFilter = null, userFilter = null, beatmapQuery = null, groupSets = false, statRequiresGroup = false, noScores = false, noModeCheck = false) {
    const base = `
    (
        select 
        ${isBeatmapResult ?
            `${groupSets ? 'beatmaps.set_id' : 'beatmaps.beatmap_id'}, ${noModeCheck?'':'beatmaps.mode,'} beatmaps.approved` :
            `users2.user_id, users2.username`}
            ${country && !groupSets && !noScores ? ', country_code' : ''}, 
            ${tableType === 'array_table' ? (beatmapQuery !== null ? beatmapQuery : 'count(*)') : stat} as stat
        ${!isBeatmapResult && tableType === 'scores' ? `
            FROM scores 
            INNER JOIN mods ON scores.enabled_mods = mods.enum 
            INNER JOIN beatmaps ON scores.beatmap_id = beatmaps.beatmap_id 
            INNER JOIN users2 ON scores.user_id = users2.user_id` : ``}
        ${!isBeatmapResult && tableType === 'user' ? `
            FROM users2
            INNER JOIN users_ppv1 ON users2.user_id = users_ppv1.user_id` : ``}
        ${tableType === 'array_table' ? `
            FROM ${stat} 
            ${groupSets ? '' :
                `${((scoreFilter || isBeatmapResult) && !noScores) ? `INNER JOIN scores ON (scores.beatmap_id = ${stat}.beatmap_id ${scoreFilter !== null ? `AND ${scoreFilter}` : ''})` : ''}
                ${!noScores ? `INNER JOIN users2 ON (${scoreFilter || isBeatmapResult ? 'scores' : stat}.user_id = users2.user_id ${userFilter !== null ? `AND ${userFilter}` : ''})` : ''}`
            }`
            : ``}
        ${fullFilter !== null ? `WHERE ${fullFilter}` : ''}
      GROUP BY 
          ${isBeatmapResult ?
            `${(groupSets ? 'beatmaps.set_id' : 'beatmaps.beatmap_id')}, ${noModeCheck?'':'beatmaps.mode,'} beatmaps.approved, beatmaps.approved_date, beatmaps.submit_date` :
            `users2.user_id${statRequiresGroup ? `, ${stat}` : ''}`}
          ${country && !groupSets && !noScores ? ', country_code' : ''}
      ) base
    `;
    return base;
}

const FC_FILTER = '(countmiss = 0 and (maxcombo - combo) <= scores.count100 or rank like \'%X%\')';

const STAT_DATA = {
    'pp': { query: 'users2.pp', table: 'user' },
    'pp_v1': { query: 'ppv1', table: 'user', requiresGroup: true },
    'ss': { query: 'ssh_count+ss_count', table: 'user' },
    's': { query: 'sh_count+s_count', table: 'user' },
    'a': { query: 'a_count', table: 'user' },
    'b': { query: 'count(*)', table: 'scores', scoreFilter: `rank LIKE '%B%'` },
    'c': { query: 'count(*)', table: 'scores', scoreFilter: `rank LIKE '%C%'` },
    'd': { query: 'count(*)', table: 'scores', scoreFilter: `rank LIKE '%D%'` },
    'playcount': { query: 'playcount', table: 'user' },
    'clears': { query: 'count(*)', table: 'scores' },
    'fc_clears': { query: `count(*)`, table: 'scores', scoreFilter: FC_FILTER },
    'playtime': { query: 'playtime', table: 'user' },
    'followers': { query: 'follower_count', table: 'user' },
    'replays_watched': { query: 'replays_watched', table: 'user' },
    'ranked_score': { query: 'ranked_score', table: 'user' },
    'lazer_standard': { query: `sum(${standardized_formula})`, table: 'scores' },
    // 'lazer_classic': { query: `sum((round((${object_count}*${object_count})*32.57+100000)*${standardized_formula}/${classic_max_score}))`, table: 'scores' },
    'lazer_classic': { query: `sum((round((${object_count}*${object_count})*32.57+100000)*${standardized_formula}/${classic_max_score}))`, table: 'scores' },
    'total_score': { query: 'total_score', table: 'user' },
    'ss_score': { query: 'sum(scores.score)', table: 'scores', scoreFilter: `rank LIKE '%X%'` },
    'fc_score': { query: `sum(scores.score)`, table: 'scores', scoreFilter: FC_FILTER },
    'as_one_map': { query: 'round(pow(avg(scores.combo)*pow(avg(beatmaps.maxcombo),-1)*0.7*sum(scores.count300+scores.count100+scores.count50+scores.countmiss)+sum(scores.count300+scores.count100*0.3333+scores.count50*0.1667)*0.3,2)*36)', table: 'scores' },
    'top_score': { query: 'max(scores.score)', table: 'scores' },
    'total_hits': { query: 'total_hits', table: 'user' },
    'scores_first_count': { query: 'scores_first_count', table: 'user' },
    'post_count': { query: 'post_count', table: 'user' },
    'ranked_beatmapset_count': { query: 'ranked_beatmapset_count', table: 'user' },
    'total_pp': { query: 'sum(scores.pp)', table: 'scores', scoreFilter: `scores.pp != 'nan'` },
    'top_pp': { query: 'max(scores.pp)', table: 'scores', scoreFilter: `scores.pp != 'nan'` },
    'avg_pp': { query: 'avg(scores.pp)', table: 'scores', scoreFilter: `scores.pp != 'nan'` },
    'avg_score': { query: 'avg(scores.score)', table: 'scores' },
    'completion': { query: 'round((cast(count(*) * 100::float/%s as numeric)), 3)', table: 'scores' },
    'avg_acc': { query: 'avg(nullif(scores.accuracy, \'nan\'))', table: 'scores' },
    'acc': { query: 'hit_accuracy', table: 'user' },
    'user_achievements': { query: 'user_achievements', table: 'array_table', isArray: true },
    'user_badges': { query: 'user_badges', table: 'array_table', isArray: true },
    'unique_ss': { query: 'unique_ss', table: 'array_table', isArray: true },
    'unique_fc': { query: 'unique_fc', table: 'array_table', isArray: true },
    'unique_dt_fc': { query: 'unique_dt_fc', table: 'array_table', isArray: true },
    'unique_hd_ss': { query: 'unique_ss', table: 'array_table', fullFilter: 'is_hd = true', isArray: true },
    'most_cleared': { query: 'beatmaps', table: 'array_table', fullFilter: 'mode = 0 AND approved in (1,2,4)', isArray: false, isBeatmaps: true },
    'most_played': { query: 'beatmaps', beatmapQuery: 'beatmaps.playcount', table: 'array_table', fullFilter: 'mode = 0 AND approved in (1,2,4)', isArray: false, isBeatmaps: true, noScores: true },
    'most_played_sets': { query: 'beatmaps', groupSets: true, beatmapQuery: 'sum(beatmaps.playcount)', table: 'array_table', fullFilter: 'approved in (1,2,4)', isArray: false, isBeatmaps: true, noScores: true, noModeCheck: true },
    'most_ssed': { query: 'beatmaps', table: 'array_table', fullFilter: 'mode = 0 AND approved in (1,2,4)', scoreFilter: 'accuracy=100', isArray: false, isBeatmaps: true, direction: 'asc' },
    'most_fm_ssed': { query: 'beatmaps', table: 'array_table', scoreFilter: '(is_hd = true and is_hr = true and is_dt = true and is_fl = true and accuracy=100)', fullFilter: 'mode = 0 AND approved in (1,2,4)', isArray: false, isBeatmaps: true },
    'longest_approval': { query: 'beatmaps', groupSets: true, beatmapQuery: 'EXTRACT(EPOCH FROM age(approved_date,submit_date))', table: 'array_table', fullFilter: 'mode = 0 AND approved in (1,2)', isArray: false, isBeatmaps: true, noScores: true  },
    'longest_maps': { query: 'beatmaps', beatmapQuery: 'length', table: 'array_table', fullFilter: 'mode = 0 AND approved in (1,2,4)', isArray: false, isBeatmaps: true, noScores: true  },
    'set_with_most_maps': { query: 'beatmaps', groupSets: true, beatmapQuery: 'count(*)', table: 'array_table', fullFilter: 'mode = 0 AND approved in (1,2,4)', isArray: false, isBeatmaps: true, noScores: true  },
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
    let base = await checkTables(_stat, stat.table, stat.scoreFilter ?? null, false, country !== undefined, null, null, null, null, stat.requiresGroup);

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
              select 
                ${/* user id */ ''}
                user_id, 
                ${/* username */ ''}
                username
                ${/* country code */''}
                ${country !== undefined ? ', country_code' : ''},
                ${/* stat */ ''}
                stat, 
                ${/* rank */ ''}
                ROW_NUMBER() over(order by stat desc) as rank 
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

async function getQueryBeatmapData(stat, limit, offset) {
    let query = '';
    let queryData = [];
    let _where = '';

    queryData = [limit, offset];

    if (stat.fullFilter) {
        _where += `${_where.length === 0 ? 'where ' : ' and '}${stat.fullFilter}`;
    }

    const _stat = parse(stat.query);
    let base = await checkTables(_stat, stat.table, stat.fullFilter ?? null, true, false, stat.scoreFilter ?? null, stat.userFilter ?? null, stat.beatmapQuery ?? null, stat.groupSets, stat.requiresGroup, stat.noScores, stat.noModeCheck);

    query = `
          select 
            rank, ${stat.groupSets ? 'set_' : 'beatmap_'}id, stat, count(*) OVER() as total_users
          from 
            (
              select ${stat.groupSets ? 'set_' : 'beatmap_'}id, stat, ROW_NUMBER() over(order by stat desc) as rank
              from ${base} ${_where}
            ) r 
          order by 
            rank ${stat.direction ?? 'asc'}
          LIMIT 
            $1 OFFSET $2
    `;
    console.log(query);

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

    console.log(selectedStat);

    if (!selectedStat.isBeatmaps) {
        return await getQueryUserData(selectedStat, limit, offset, country);
    } else {
        return await getQueryBeatmapData(selectedStat, limit, offset);
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
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT, timeout: 30000 });
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

        queryInfo = await getQuery(stat, limit + (offset > 0 ? 1 : 0), Math.max(offset - 1, 0), country, removeFirst = offset > 0);
        if (!queryInfo) {
            res.status(400).send('Invalid stat');
            return;
        }

        const { rows } = await client.query(queryInfo[0], queryInfo[1]);
        await client.end();

        const total_users = rows[0]?.total_users ?? 0;
        rows.forEach(row => {
            row.total_users = undefined;
        });

        for (let i = 0; i < rows.length; i++) {
            const previous_stat = Number(rows[i - 1]?.stat ?? null);
            const stat = Number(rows[i].stat);
            if (previous_stat) {
                rows[i].diff = stat - previous_stat;
            } else {
                rows[i].diff = null;
            }
        }

        if (offset > 0) {
            //remove first row
            rows.shift();
        }

        if (queryInfo[2] === 'users') {
            try {
                const users = await GetOsuUsers(rows.map(row => row.user_id));
                if (users) {
                    users.forEach(osu_user => {
                        const row = rows.find(row => row.user_id === osu_user.id);
                        row.osu_user = osu_user;
                    });
                }

                const inspectorUsers = await InspectorUser.findAll({ where: { osu_id: rows.map(row => row.user_id) } });
                if (inspectorUsers) {
                    inspectorUsers.forEach(inspector_user => {
                        const row = rows.find(row => row.user_id === inspector_user.osu_id);
                        row.inspector_user = inspector_user;
                    });
                }
            } catch (e) {
                console.error(e);
            }
        }
        if (queryInfo[2] === 'beatmaps' || queryInfo[2] === 'beatmapsets') {
            //beatmap data
            try {
                const idPropertyField = queryInfo[2] === 'beatmaps' ? 'beatmap_id' : 'set_id';
                const beatmaps = await GetBeatmaps({ id: rows.map(row => row[idPropertyField]), include_loved: 'true', include_qualified: 'true', isSetID: queryInfo[2] === 'beatmapsets' });
                if (beatmaps) {
                    beatmaps.forEach(osu_beatmap => {
                        const row = rows.find(row => row[idPropertyField] == osu_beatmap[idPropertyField]);
                        if (!row.osu_beatmap) {
                            row.osu_beatmap = osu_beatmap;
                        }
                    });
                }
            } catch (e) {
                console.error(e);
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
