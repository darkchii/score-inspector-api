const { Databases, InspectorScoreStat } = require("../helpers/db");

const cacher = {
    func: UpdateScoreStatistics,
    name: 'UpdateScoreStatistics',
}

module.exports = cacher;

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
