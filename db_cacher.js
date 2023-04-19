//this script is to store some data in the local database, like overall score statistics.
//mainly to circumvent extremely slow sql queries that don't need to be live

const { Client } = require("pg");
const { beatmap_columns } = require("./helpers/osualt");
const { InspectorScoreStat } = require("./helpers/db");
const { Op, Sequelize } = require('sequelize');
require('dotenv').config();

function StartCacher() {
    Loop();
}
module.exports = StartCacher;

async function Loop() {
    setInterval(async () => {
        console.log("Updating score statistics");
        await UpdateScoreStatistics(['24h', '7d', 'all']);
    }, 1000 * 60 * 60);

    setInterval(async () => {
        console.log("Updating beatmap statistics");
        await UpdateScoreStatistics(['10min']);
    }, 1000 * 60 * 10);
    //check database timezone and time
    // const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
    // await client.connect();
    // const result = await client.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') as test, NOW() as now, CURRENT_TIMESTAMP as current_timestamp");
    // //newest score as test (by time)
    // const newest_score = await client.query("SELECT * FROM scores ORDER BY date_played DESC LIMIT 1");
    // await client.end();
    // console.log(newest_score.rows[0]);
    // console.log(result.rows[0]);

    // first time run immediately
    await UpdateScoreStatistics(['10min']);
    await UpdateScoreStatistics(['24h', '7d', 'all']);
}

const user_rows = [
    { key: "user_most_scores", select: "count(*)" },
    { key: "user_most_pp", select: "sum(case when scores.pp = 'NaN' then 0 else scores.pp end)" }
]

async function UpdateScoreStatistics(STAT_PERIODS) {
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
        SUM(CASE WHEN (enabled_mods::integer & 16) > 0 THEN length * 1.5
             WHEN (enabled_mods::integer & 256) > 0 THEN length * 0.75
             ELSE length END) as total_length,
        count(*) FILTER (WHERE rank = 'XH') as scores_xh,
        count(*) FILTER (WHERE rank = 'X') as scores_x,
        count(*) FILTER (WHERE rank = 'SH') as scores_sh,
        count(*) FILTER (WHERE rank = 'S') as scores_s,
        count(*) FILTER (WHERE rank = 'A') as scores_a,
        count(*) FILTER (WHERE rank = 'B') as scores_b,
        count(*) FILTER (WHERE rank = 'C') as scores_c,
        count(*) FILTER (WHERE rank = 'D') as scores_d,
        sum(count300+count100+count50) as total_hits,
        avg(stars) as avg_stars,
        avg(combo) as avg_combo,
        avg(length) as avg_length,
        avg(score) as avg_score,
        avg(case when scores.pp = 'NaN' then 0 else scores.pp end) as avg_pp,
        avg(perfect) as fc_rate,
        to_timestamp(avg(extract(epoch from approved_date)))::date as average_map_age
    FROM scores 
    ${join_query} 
    WHERE ${approved_query}`;

    const user_columns = 'users2.user_id, users2.username';

    let _res = {};
    _res.time = new Date().getTime();
    for await (const period of STAT_PERIODS) {
        let time_query = '';
        if (period === '24h') {
            time_query = 'AND (date_played BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE \'UTC\') - INTERVAL \'24 HOURS\' AND (CURRENT_TIMESTAMP AT TIME ZONE \'UTC\'))';
        } else if (period === '7d') {
            time_query = 'AND (date_played BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE \'UTC\') - INTERVAL \'7 DAYS\' AND (CURRENT_TIMESTAMP AT TIME ZONE \'UTC\'))';
        } else if (period === '10min') {
            time_query = 'AND (date_played BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE \'UTC\') - INTERVAL \'10 MIN\' AND (CURRENT_TIMESTAMP AT TIME ZONE \'UTC\'))';
        }

        const { rows } = await client.query(`${full_query} ${time_query}`);

        // insert/update all rows into database
        for await (const key of Object.keys(rows[0])) {
            let value = JSON.stringify(rows[0][key]);

            //find existing row where both key and period match
            let row = await InspectorScoreStat.findOne({
                where: {
                    key: key,
                    period: period
                }
            });

            if (row) {
                //update existing row 
                await InspectorScoreStat.update({
                    value: value
                }, {
                    where: {
                        key: key,
                        period: period
                    }
                });
            } else {
                //create new row
                await InspectorScoreStat.create({
                    key: key,
                    period: period,
                    value: value
                });
            }
        }


        const most_played_map_columns = beatmap_columns;
        const { rows: most_played_maps } = await client.query(`SELECT count(*), ${most_played_map_columns} FROM scores ${join_query} WHERE ${approved_query} ${time_query} GROUP BY ${most_played_map_columns} ORDER BY count(*) DESC LIMIT 5`);

        //store most played maps in a single row
        let most_played_maps_json = JSON.stringify(most_played_maps);
        let most_played_maps_row = await InspectorScoreStat.findOne({
            where: {
                key: 'most_played_maps',
                period: period
            }
        });

        if (most_played_maps_row) {
            await InspectorScoreStat.update({ value: most_played_maps_json }, { where: { key: 'most_played_maps', period: period } });
        } else {
            await InspectorScoreStat.create({
                key: 'most_played_maps',
                period: period,
                value: most_played_maps_json
            });
        }

        for await (const user_row of user_rows) {
            const { rows: _data } = await client.query(`SELECT ${user_row.select} as c, ${user_columns} FROM scores ${join_query} WHERE ${approved_query} ${time_query} GROUP BY ${user_columns} ORDER BY ${user_row.select} DESC LIMIT 1`);
            
            const data_json = JSON.stringify(_data[0]);
            let data_row = await InspectorScoreStat.findOne({ where: { key: user_row.key, period: period } });
            if (data_row) {
                await InspectorScoreStat.update({ value: data_json }, { where: { key: user_row.key, period: period } });
            } else {
                await InspectorScoreStat.create({ key: user_row.key, period: period, value: data_json });
            }
        }
    }

    await client.end();

    // console.log(_res);
}