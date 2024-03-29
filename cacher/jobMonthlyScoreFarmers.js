const { InspectorScoreStat, Databases } = require("../helpers/db");

const cacher = {
    func: UpdateMonthlyScoreFarmers,
    name: 'monthly_score_farmers'
}

module.exports = cacher;

const PERIODS_TO_UPDATE = [
    {
        name: 'month',
        slice: 7,
        user_count: 1
    },
    {
        name: 'year',
        slice: 4,
        user_count: 1
    }
];
async function UpdateMonthlyScoreFarmers() {
    //get top 10 users by sum(score) on beatmaps ranked in each month

    let overtake_log = [];

    const _data = await InspectorScoreStat.findOne({
        where: {
            key: 'monthly_score_farmers_log',
        }
    });

    if (!_data) {
        await InspectorScoreStat.create({
            key: 'monthly_score_farmers_log',
            period: 'misc',
            value: JSON.stringify([])
        });
    } else {
        overtake_log = JSON.parse(_data.dataValues.value);
    }

    for await (const period of PERIODS_TO_UPDATE) {
        const data = await Databases.osuAlt.query(`
        WITH MonthlyScores AS (
            SELECT
                s.user_id,
                username,
                DATE_TRUNC('${period.name}', b.approved_date AT TIME ZONE 'UTC') AS ${period.name},
                s.score
            FROM
                beatmaps b
            JOIN scores s ON b.beatmap_id = s.beatmap_id
            JOIN users2 u ON s.user_id = u.user_id
            WHERE b.approved IN (1, 2, 4) AND mode = 0
        )
        , RankedMonthlyScores AS (
            SELECT
                user_id,
                username,
                ${period.name},
                SUM(score) AS total_score,
                ROW_NUMBER() OVER (PARTITION BY ${period.name} ORDER BY SUM(score) DESC) AS rnk
            FROM
                MonthlyScores
            GROUP BY
                user_id, username, ${period.name}
        )
        SELECT
            rnk AS rank,
            user_id,
            username,
            ${period.name} as period,
            total_score
        FROM
            RankedMonthlyScores
        WHERE
            rnk <= ${period.user_count}
        `);

        console.log(`[MONTHLY SCORE FARMERS] Got ${data[0].length} rows.`);


        //reformat data
        const _data = [];

        for await (const row of data[0]) {
            _data.push({
                user_id: row.user_id,
                username: row.username,
                rank: row.rank,
                //convert to UTC and YYYY-MM
                period: new Date(row.period).toISOString().split('T')[0].slice(0, period.slice),
                total_score: row.total_score
            });
        }

        for await (const row of _data) {
            //check if row already exists
            const exists = await InspectorScoreStat.findOne({
                where: {
                    key: 'monthly_score_farmers',
                    period: row.period
                }
            });

            if (exists) {
                const previous_value = JSON.parse(exists.dataValues.value);
                const current_value = row;
                if (current_value.total_score > previous_value.total_score) {
                    if (previous_value.user_id !== current_value.user_id) {
                        //user overtook someone else
                        overtake_log.push({
                            period: current_value.period,
                            old_user_id: previous_value.user_id,
                            old_username: previous_value.username,
                            new_user_id: current_value.user_id,
                            new_username: current_value.username,
                            old_total_score: previous_value.total_score,
                            new_total_score: current_value.total_score,
                            //utc time
                            time: new Date().toISOString()
                        });
                    }
                }
                //update but remember both for logging reasons
                await InspectorScoreStat.update({
                    value: JSON.stringify(row)
                }, {
                    where: {
                        key: 'monthly_score_farmers',
                        period: row.period,
                    }
                });
            } else {
                //create
                await InspectorScoreStat.create({
                    key: 'monthly_score_farmers',
                    period: row.period,
                    value: JSON.stringify(row)
                });

            }
        }
    }

    //update log
    await InspectorScoreStat.update({
        value: JSON.stringify(overtake_log)
    }, {
        where: {
            key: 'monthly_score_farmers_log',
        }
    });
    console.log(`[MONTHLY SCORE FARMERS] Updated database.`)
}