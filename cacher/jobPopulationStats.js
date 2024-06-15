const { Sequelize } = require("sequelize");
const { Raw, InspectorCountryStat, AltUser } = require("../helpers/db");
const { AuthorizedApiCall } = require("../helpers/osu");

const cacher = {
    func: UpdatePopulationStats,
    name: 'population_stats'
}

module.exports = cacher;

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
            console.log(`[POPULATION STATS] ${country.code} failed`);
        }
    }

    console.log(`[POPULATION STATS] Updated database.`);
}