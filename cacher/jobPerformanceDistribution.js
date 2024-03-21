const { Databases, InspectorScoreStat } = require("../helpers/db");

const cacher = {
    func: UpdatePerformanceDistribution,
    name: 'UpdatePerformanceDistribution',
}

module.exports = cacher;

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

        console.log(`[PP DISTRIBUTION] ${pp} - ${pp + 100} done.`);
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
    } else {
        console.log(`[PP DISTRIBUTION] No rows found, is scores table empty? ...`);
    }
}