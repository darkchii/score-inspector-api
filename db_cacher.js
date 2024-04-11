//this script is to store some data in the local database, like overall score statistics.
//mainly to circumvent extremely slow sql queries that don't need to be live

const { beatmap_columns } = require("./helpers/osualt");
const { InspectorScoreStat, AltUser, Databases, Raw, InspectorCountryStat } = require("./helpers/db");
const { Sequelize } = require('sequelize');
const { db_now } = require("./helpers/misc");
const schedule = require('node-schedule');
const { AuthorizedApiCall } = require("./helpers/osu.js");
const scoreStatCacher = require("./cacher/jobScoreStatistics.js");
const scoreRankCacher = require("./cacher/jobScoreRanks.js");
const performanceDistCacher = require("./cacher/jobPerformanceDistribution.js");
const milestonesCacher = require("./cacher/jobMilestones.js");
const performanceRecordsCacher = require("./cacher/jobPerformanceRecords.js");
const monthlyScoreFarmersCacher = require("./cacher/jobMonthlyScoreFarmers.js");
const populationStatsCacher = require("./cacher/jobPopulationStats.js");
const systemStatsCacher = require("./cacher/jobSystemStats.js");
const mapPollCacher = require("./cacher/jobMapPoll.js");
require('dotenv').config();

function StartCacher() {
    Loop();
}
module.exports = StartCacher;

const Cachers = [
    { cacher: scoreStatCacher, interval: '0 * * * *', data: ['24h', '7d', 'all'] },
    { cacher: scoreStatCacher, interval: '*/30 * * * *', data: ['30min'] },
    { cacher: scoreRankCacher, interval: '1 0 * * *', data: [] },
    { cacher: performanceDistCacher, interval: '0 * * * *', data: [] },
    { cacher: milestonesCacher, interval: '0 * * * *', data: [] },
    { cacher: performanceRecordsCacher, interval: '0 * * * *', data: [] },
    { cacher: monthlyScoreFarmersCacher, interval: '0 * * * *', data: [] },
    { cacher: populationStatsCacher, interval: '0 * * * *', data: [] },
    { cacher: systemStatsCacher, interval: '*/15 * * * *', data: [] },
]

mapPollCacher.func();

async function Loop() {
    for await (const cacher of Cachers) {
        schedule.scheduleJob(cacher.interval, () => {
            try{
                console.log(`[CACHER] Running ${cacher.cacher.name} ...`);
                cacher.cacher.func(cacher.data);
            }catch(e){
                console.error(e);
            }
        });
        console.log(`[CACHER] Scheduled ${cacher.cacher.name} to run every ${cacher.interval}`);
    }
}

const user_rows = [
    { key: "user_most_scores", select: "count(*)" },
    { key: "user_most_pp", select: "sum(case when scores.pp = 'NaN' then 0 else scores.pp end)" },
    { key: "user_top_pp", select: "max(case when scores.pp = 'NaN' then 0 else scores.pp end)" },
    { key: "user_most_score", select: "sum(score)" },
    { key: "user_top_score", select: "max(score)" },
]


async function UpdateScoreStatistics(STAT_PERIODS) {
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

        const [rows] = await Databases.osuAlt.query(`${full_query} ${time_query}`);
        rows[0].average_map_age = new Date(`${rows[0].average_map_age} UTC`);

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
        // const { rows: most_played_maps } = await client.query(`SELECT count(*), ${most_played_map_columns} FROM scores ${join_query} WHERE ${approved_query} ${time_query} GROUP BY ${most_played_map_columns} ORDER BY count(*) DESC LIMIT 5`);
        const [most_played_maps] = await Databases.osuAlt.query(`SELECT count(*), ${most_played_map_columns} FROM scores ${join_query} WHERE ${approved_query} ${time_query} GROUP BY ${most_played_map_columns} ORDER BY count(*) DESC LIMIT 5`);

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
            // const { rows: _data } = await client.query(`SELECT ${user_row.select} as c, ${user_columns} FROM scores ${join_query} WHERE ${approved_query} ${time_query} GROUP BY ${user_columns} ORDER BY ${user_row.select} DESC LIMIT 1`);
            const [_data] = await Databases.osuAlt.query(`SELECT ${user_row.select} as c, ${user_columns} FROM scores ${join_query} WHERE ${approved_query} ${time_query} GROUP BY ${user_columns} ORDER BY ${user_row.select} DESC LIMIT 1`);

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
}



// UpdateMonthlyScoreFarmers();

async function UpdatePopulationStats() {
    console.log(`[POPULATION STATS] Updating ...`);
    let countries = [];
    //5 pages to get
    for (let i = 1; i <= 5; i++) {
        let pageString = `cursor[page]=${i}`
        try {
            const url = `https://osu.ppy.sh/api/v2/rankings/osu/country?${pageString}`;
            const res = await AuthorizedApiCall(url, 'get', null);
            countries = [...countries, ...res.data.ranking]
        } catch (err) {
            throw new Error('Unable to get data: ' + err.message);
        }
    }

    for await (const country of countries) {
        try {
            const country_code = country.code;

            const data = {
                code: country_code,
            }

            const [_data] = await Raw(`
                SELECT 
                    count(*) as alt_scores, 
                    sum(case when scores.rank LIKE 'XH' then 1 else 0 end) as ssh_count,
                    sum(case when scores.rank LIKE 'X' then 1 else 0 end) as ss_count,
                    sum(case when scores.rank LIKE 'SH' then 1 else 0 end) as sh_count,
                    sum(case when scores.rank LIKE 'S' then 1 else 0 end) as s_count,
                    sum(case when scores.rank LIKE 'A' then 1 else 0 end) as a_count,
                    sum(case when scores.rank LIKE 'B' then 1 else 0 end) as b_count,
                    sum(case when scores.rank LIKE 'C' then 1 else 0 end) as c_count,
                    sum(case when scores.rank LIKE 'D' then 1 else 0 end) as d_count,
                    avg(scores.accuracy) as avg_acc,
                    avg(COALESCE(scores.pp, 0)) AS avg_pp
                FROM scores
                INNER JOIN users2 ON scores.user_id = users2.user_id
                WHERE users2.country_code = '${country_code}' AND scores.pp IS NOT NULL AND scores.pp != 'NaN';
            `, 'osuAlt');

            const general_data = _data[0];

            data.stats = {};

            data.stats.alt_scores = Number(general_data.alt_scores);
            data.stats.ssh_count = Number(general_data.ssh_count);
            data.stats.ss_count = Number(general_data.ss_count);
            data.stats.sh_count = Number(general_data.sh_count);
            data.stats.s_count = Number(general_data.s_count);
            data.stats.a_count = Number(general_data.a_count);
            data.stats.b_count = Number(general_data.b_count);
            data.stats.c_count = Number(general_data.c_count);
            data.stats.d_count = Number(general_data.d_count);
            data.stats.avg_acc = Number(general_data.avg_acc);
            data.stats.avg_pp = Number(general_data.avg_pp);

            data.stats.active_users = country.active_users;
            data.stats.play_count = country.play_count;
            data.stats.ranked_score = country.ranked_score;
            data.stats.performance = country.performance;

            //get sum of the highest score per beatmap
            const [_data2] = await Raw(`
                SELECT sum(max_score) as max_score
                FROM (
                    SELECT beatmap_id, max(score) as max_score
                    FROM scores
                    INNER JOIN users2 ON scores.user_id = users2.user_id
                    WHERE users2.country_code = '${country_code}'
                    GROUP BY beatmap_id
                ) as t;
            `, 'osuAlt');

            const max_score_data = _data2[0];
            data.stats.max_score = Number(max_score_data.max_score);

            const [data_3] = await AltUser.findAll({
                attributes: [
                    [Sequelize.fn('COUNT', Sequelize.col('country_code')), 'alt_players'],
                    [Sequelize.fn('SUM', Sequelize.col('total_score')), 'total_score'],
                    [Sequelize.fn('SUM', Sequelize.col('playcount')), 'playcount'],
                    [Sequelize.fn('SUM', Sequelize.col('playtime')), 'playtime'],
                    [Sequelize.fn('SUM', Sequelize.col('total_hits')), 'total_hits'],
                    [Sequelize.fn('SUM', Sequelize.col('replays_watched')), 'replays_watched'],
                ],
                where: {
                    country_code: country_code
                },
            });

            // console.log(data_3.dataValues);
            data.stats.alt_players = Number(data_3.dataValues.alt_players);
            data.stats.perc_on_alt = (data.stats.alt_players / data.stats.active_users) * 100;
            data.stats.total_score = Number(data_3.dataValues.total_score);
            data.stats.playcount = Number(data_3.dataValues.playcount);
            data.stats.playtime = Number(data_3.dataValues.playtime);
            data.stats.total_hits = Number(data_3.dataValues.total_hits);
            data.stats.replays_watched = Number(data_3.dataValues.replays_watched);

            //go through each data point and update the database
            for await (const key of Object.keys(data.stats)) {
                const value = data.stats[key];
                //find existing row where both key and period match
                let row = await InspectorCountryStat.findOne({
                    where: {
                        country_code: country_code,
                        stat: key
                    }
                });

                if (row) {
                    //update existing row 
                    await InspectorCountryStat.update({
                        value: value
                    }, {
                        where: {
                            country_code: country_code,
                            stat: key
                        }
                    });
                } else {
                    //create new row
                    await InspectorCountryStat.create({
                        country_code: country_code,
                        stat: key,
                        value: value
                    });
                }
            }

            console.log(`[POPULATION STATS] ${country.code} done.`);
        } catch (err) {
            console.error(err);
            console.log(`[POPULATION STATS] ${country.code} failed`);
        }
    }

    console.log(`[POPULATION STATS] Updated database.`);
}
// UpdatePopulationStats();