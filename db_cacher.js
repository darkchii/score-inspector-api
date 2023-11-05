//this script is to store some data in the local database, like overall score statistics.
//mainly to circumvent extremely slow sql queries that don't need to be live

const { Client } = require("pg");
const { beatmap_columns } = require("./helpers/osualt");
const { InspectorScoreStat, InspectorHistoricalScoreRank, AltUser, InspectorOsuUser, InspectorUserMilestone, Databases, InspectorPerformanceRecord } = require("./helpers/db");
const { Op, Sequelize } = require('sequelize');
const { db_now, sleep } = require("./helpers/misc");
const { default: axios } = require("axios");
const { default: axiosRetry } = require("axios-retry");
const schedule = require('node-schedule');
require('dotenv').config();

function StartCacher() {
    Loop();
}
module.exports = StartCacher;

async function Loop() {
    const score_stat_job = schedule.scheduleJob('0 * * * *', function () { //every hour
        console.log("Updating score statistics");
        UpdateScoreStatistics(['24h', '7d', 'all']);
    })

    const score_stat_job2 = schedule.scheduleJob('30 * * * *', function () { //every 30 minutes
        console.log("Updating score statistics");
        UpdateScoreStatistics(['30min']);
    })

    //update score ranks every day at 00:01
    const score_job = schedule.scheduleJob('1 0 * * *', function () { //every day
        console.log("Updating score statistics");
        try {
            UpdateScoreRanks();
        } catch (e) {
            console.error(e);
        }
    });

    const performance_distribution_job = schedule.scheduleJob('0 * * * *', function () { //every hour
        console.log("Updating performance distribution");
        try {
            UpdatePerformanceDistribution();
        } catch (e) {
            console.error(e);
        }
    });

    const milestone_job = schedule.scheduleJob('0 */1 * * *', function () { //every hour
        console.log("Updating users");
        try {
            UpdateUsers();
        } catch (e) {
            console.error(e);
        }
    });
}

const user_rows = [
    { key: "user_most_scores", select: "count(*)" },
    { key: "user_most_pp", select: "sum(case when scores.pp = 'NaN' then 0 else scores.pp end)" },
    { key: "user_top_pp", select: "max(case when scores.pp = 'NaN' then 0 else scores.pp end)" },
    { key: "user_most_score", select: "sum(score)" },
    { key: "user_top_score", select: "max(score)" },
]

async function UpdatePerformanceDistribution() {
    console.log(`[PP DISTRIBUTION] Updating ...`);

    console.log(`[PP DISTRIBUTION] Get highest PP value ...`);

    const highest_pp = await Databases.osuAlt.query(`SELECT MAX(pp) FROM scores WHERE pp > 0 AND NULLIF(pp, 'NaN'::NUMERIC) IS NOT NULL;`);

    console.log(`[PP DISTRIBUTION] Got highest PP value: ${highest_pp[0][0].max}.`);

    //create a table of 100s from 0 to highest_pp
    const pp_table = [];
    for (let i = 0; i <= highest_pp[0][0].max; i += 100) {
        pp_table.push(i);
    }

    //for each 100, get the amount of scores that have that pp, and the user with the most scores at that pp
    const pp_distribution = [];
    for await (const pp of pp_table) {
        const PP_QUERY = 'ROUND(pp)';
        //find the amount of scores with pp between pp and pp+100
        const score_count = await Databases.osuAlt.query(`SELECT COUNT(*) FROM scores WHERE ${PP_QUERY} >= ${pp} AND ${PP_QUERY} < ${pp + 100} AND pp > 0 AND NULLIF(pp, 'NaN'::NUMERIC) IS NOT NULL;`);

        //find the user with the most scores with pp between pp and pp+100
        const user_count = await Databases.osuAlt.query(`SELECT user_id, COUNT(*) FROM scores WHERE ${PP_QUERY} >= ${pp} AND ${PP_QUERY} < ${pp + 100} AND pp > 0 AND NULLIF(pp, 'NaN'::NUMERIC) IS NOT NULL GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1;`);

        pp_distribution.push({
            count: score_count[0][0].count,
            pp_range: pp,
            most_common_user_id: user_count?.[0]?.[0]?.user_id ?? null,
            most_common_user_id_count: user_count?.[0]?.[0]?.count ?? null
        });

        console.log(`[PP DISTRIBUTION] ${pp} - ${pp+100} done.`);
    }

    console.log(`[PP DISTRIBUTION] Got ${pp_distribution.length} rows.`);

    if (pp_distribution && pp_distribution.length > 0) {
        const pp_distribution_json = JSON.stringify(pp_distribution);

        //delete old pp_distribution rows
        await InspectorScoreStat.destroy({
            where: {
                key: 'pp_distribution'
            }
        });

        await InspectorScoreStat.create({ key: 'pp_distribution', period: 'misc', value: pp_distribution_json });

        console.log(`[PP DISTRIBUTION] Updated database.`);
    }else{
        console.log(`[PP DISTRIBUTION] No rows found, is scores table empty? ...`);
    }
}

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
            time_query = `AND (date_played BETWEEN ${db_now} - INTERVAL \'24 HOURS\' AND ${db_now})`;
        } else if (period === '7d') {
            time_query = `AND (date_played BETWEEN ${db_now} - INTERVAL \'7 DAYS\' AND ${db_now})`;
        } else if (period === '10min') {
            time_query = `AND (date_played BETWEEN ${db_now} - INTERVAL \'10 MIN\' AND ${db_now})`;
        } else if (period === '30min') {
            time_query = `AND (date_played BETWEEN ${db_now} - INTERVAL \'30 MIN\' AND ${db_now})`;
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

        //update time
        let time_row = await InspectorScoreStat.findOne({ where: { key: 'updated_at', period: period } });
        if (time_row) {
            await InspectorScoreStat.update({ value: new Date().toISOString() }, { where: { key: 'updated_at', period: period } });
        } else {
            await InspectorScoreStat.create({ key: 'updated_at', period: period, value: new Date().toISOString() });
        }

        console.log(`[STATS] ${period} stats updated.`);
    }

    await client.end();

    // console.log(_res);
}

const SCORE_RANK_PAGES = 200;
async function UpdateScoreRanks() {
    const FULL_LIST = [];

    //get a Date object of yesterday 00:00:00
    const YESTERDAY = new Date();
    YESTERDAY.setDate(YESTERDAY.getDate() - 1);
    YESTERDAY.setHours(0, 0, 0, 0);


    //get a Date object of the day before yesterday 00:00:00
    const DAY_BEFORE_YESTERDAY = new Date();
    DAY_BEFORE_YESTERDAY.setDate(DAY_BEFORE_YESTERDAY.getDate() - 2);
    DAY_BEFORE_YESTERDAY.setHours(0, 0, 0, 0);

    //check if CURRENT_TIME is already in database
    const exists = await InspectorHistoricalScoreRank.findOne({
        where: {
            date: YESTERDAY
        }
    });

    if (exists) {
        console.log(`[SCORE RANKS] ${YESTERDAY} already exists in database, retrying in a bit ...`);
        await sleep(1000 * 60 * 5); //5 minutes
        return UpdateScoreRanks();
    }

    let RETRIES = 0;
    let CURRENT_PAGE = 1;

    while (CURRENT_PAGE <= SCORE_RANK_PAGES) {
        // const data = await axios.get(`https://score.respektive.pw/rankings/?page=${CURRENT_PAGE}`);
        const client = axios.create({
            baseURL: 'https://score.respektive.pw',
            timeout: 2500
        });
        axiosRetry(client, { retries: 3 });


        let _data = null;
        try {
            const data = await client.get(`/rankings/?page=${CURRENT_PAGE}`);
            _data = Object.values(data?.data);
        } catch (e) {
            console.log(`[SCORE RANKS] Failed to fetch page ${CURRENT_PAGE}, retrying ...`);
            await sleep(1000);
            RETRIES++;
            continue;
        }

        if (!_data || !_data.length || _data.length === 0) {
            if (RETRIES >= 3) {
                console.log(`[SCORE RANKS] Failed to fetch page ${CURRENT_PAGE} 3 times, skipping ...`);
                CURRENT_PAGE++;
                RETRIES = 0;
                continue;
            }

            console.log(`[SCORE RANKS] Failed to fetch page ${CURRENT_PAGE}, retrying ...`);
            await sleep(1000);
            RETRIES++;
            continue;
        }

        //add objects of lb to FULL_LIST
        for await (const row of _data) {
            FULL_LIST.push(row);
        }

        RETRIES = 0;
        CURRENT_PAGE++;
    }

    console.log(`[SCORE RANKS] Fetched ${FULL_LIST.length} score rank pairs.`);
    console.log(`[SCORE RANKS] Updating database ...`);

    let FIXED_ARR = [];
    //current time but 1 day ago

    //get entire set from day before
    const DAY_BEFORE_SET = await InspectorHistoricalScoreRank.findAll({
        where: {
            //convert to YYYY-MM-DD format, omitting time
            date: DAY_BEFORE_YESTERDAY
        }
    });

    //get current day in DD/MM/YYYY format
    for await (const row of FULL_LIST) {
        //get user from day before
        const user = DAY_BEFORE_SET?.find(x => x.osu_id === row.user_id);

        const obj = {
            osu_id: row.user_id,
            username: row.username,
            rank: row.rank,
            old_rank: user ? user.rank : null,
            ranked_score: row.score,
            old_ranked_score: user ? user.ranked_score : null,
            date: YESTERDAY
        }
        FIXED_ARR.push(obj);
    }
    // console.log(FIXED_ARR);
    if (FIXED_ARR.length !== 10000) return;

    await InspectorHistoricalScoreRank.bulkCreate(FIXED_ARR);

    console.log(`[SCORE RANKS] Updated database.`);
}

//for example, if old user has 3950, and new one has 4005, then they get an achievement for reaching 4000
//if old or new is -1, ignore
const ACHIEVEMENT_INTERVALS = [
    {
        name: 'Total SS',
        stats: ['ssh_count', 'ss_count'], //sum
        dir: '>',
        interval: 1000 //every 1000 ss is an achievement
    },
    {
        name: 'Total S',
        stats: ['sh_count', 's_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Silver SS',
        stats: ['ssh_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Silver S',
        stats: ['sh_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Gold SS',
        stats: ['ss_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Gold S',
        stats: ['s_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'A',
        stats: ['a_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Clears',
        stats: ['ssh_count', 'ss_count', 'sh_count', 's_count', 'a_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Ranked Score',
        stats: ['ranked_score'],
        dir: '>',
        interval: 10000000000
    }, {
        name: 'Total Score',
        stats: ['total_score'],
        dir: '>',
        interval: 10000000000
    }, {
        name: 'PP',
        stats: ['pp'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Playtime',
        stats: ['playtime'],
        dir: '>',
        interval: 360000 //every 100 hours is a milestone
    }, {
        name: 'Playcount',
        stats: ['playcount'],
        dir: '>',
        interval: 10000
    }, {
        name: 'Level',
        stats: ['level'],
        dir: '>',
        interval: 1
    }, {
        name: 'Global Rank',
        stats: ['global_rank'],
        dir: '<',
        interval: 100000, //every 100000 ranks is a milestone
        intervalAlternative: [
            {
                dir: '<',
                check: 200000,
                interval: 10000 //if rank under 200000, every 10000 ranks is a milestone
            },
            {
                dir: '<',
                check: 10000,
                interval: 1000 //if rank under 10000, every 1000 ranks is a milestone
            },
            {
                dir: '<',
                check: 1000,
                interval: 100 //if rank under 1000, every 100 ranks is a milestone
            },
            {
                dir: '<',
                check: 100,
                interval: 10 //if rank under 100, every 10 ranks is a milestone
            }
        ]
    }
]

async function UpdateUsers() {
    //get column names from InspectorOsuUser
    const columns = Object.keys(InspectorOsuUser.rawAttributes);

    const remote_users = await AltUser.findAll({
        attributes: columns,
        raw: true
    });
    const local_users = await InspectorOsuUser.findAll({
        attributes: columns,
        raw: true
    });

    //check if any stat went over a threshold for achievement
    for await (const user of remote_users) {
        const local_user = local_users.find(x => x.user_id === user.user_id);
        if (!local_user) continue;

        for await (const achievement of ACHIEVEMENT_INTERVALS) {
            let old_stat = 0;
            let new_stat = 0;
            for await (const stat of achievement.stats) {
                old_stat += parseInt(local_user[stat]);
                new_stat += parseInt(user[stat]);
            }

            if (old_stat === -1 || new_stat === -1) continue;

            let interval = achievement.interval;

            if (achievement.intervalAlternative) {
                for await (const alt of achievement.intervalAlternative) {
                    if (alt.dir === '<' && new_stat < alt.check && interval > alt.interval) {
                        interval = alt.interval;
                    } else if (alt.dir === '>' && new_stat > alt.check && interval < alt.interval) {
                        interval = alt.interval;
                    }
                }
            }

            let normalized_old_stat = Math.floor(old_stat / interval);
            let normalized_new_stat = Math.floor(new_stat / interval);

            if (normalized_old_stat === normalized_new_stat) continue;
            if (achievement.dir === '>' && normalized_new_stat < normalized_old_stat) continue;
            if (achievement.dir === '<' && normalized_new_stat > normalized_old_stat) continue;

            const reached_milestone = achievement.dir === '>' ? normalized_new_stat : normalized_old_stat;

            await InspectorUserMilestone.create({
                user_id: user.user_id,
                achievement: achievement.name,
                count: reached_milestone * interval,
                time: new Date()
            });
            console.log(`[MILESTONE] ${user.username} reached ${reached_milestone * interval} (${achievement.name})`)
        }
    }

    // //insert or update all users in InspectorOsuUser
    await InspectorOsuUser.bulkCreate(remote_users, {
        updateOnDuplicate: columns
    });
}

async function UpdatePerformanceRecords(){
    console.log(`[PERFORMANCE RECORDS] Updating ...`);
    const data = await Databases.osuAlt.query(`
    SELECT s.*
    FROM (
      SELECT
        beatmap_id,
        user_id,
        date_played,
        pp,
        MAX(pp) OVER (ORDER BY date_played ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS max_pp
      FROM scores
      WHERE NOT (pp IS NULL OR pp = 'NaN')
    ) AS s
    WHERE s.pp = s.max_pp
    ORDER BY s.date_played;
    `);
    
    console.log(`[PERFORMANCE RECORDS] Got ${data[0].length} rows.`);

    const _data = data[0].map(x => {
        return {
            beatmap_id: x.beatmap_id,
            user_id: x.user_id,
            date_played: x.date_played,
            pp: x.pp
        }
    });

    if(_data && _data.length > 0){
        //empty table
        await InspectorPerformanceRecord.destroy({
            where: {}
        });

        //insert new data
        await InspectorPerformanceRecord.bulkCreate(_data);
        console.log(`[PERFORMANCE RECORDS] Updated database.`);
    }else{
        console.log(`[PERFORMANCE RECORDS] No data found, is scores table empty? ...`);
    }
}
// UpdateScoreRanks();
// UpdateUsers();
// UpdatePerformanceDistribution();
// UpdatePerformanceRecords();