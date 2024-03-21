const { Databases, InspectorPerformanceRecord } = require("../helpers/db");

const cacher = {
    func: UpdatePerformanceRecords,
    name: 'UpdatePerformanceRecords',
}

module.exports = cacher;

async function UpdatePerformanceRecords() {
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

    if (_data && _data.length > 0) {
        //empty table
        await InspectorPerformanceRecord.destroy({
            where: {}
        });

        //insert new data
        await InspectorPerformanceRecord.bulkCreate(_data);
        console.log(`[PERFORMANCE RECORDS] Updated database.`);
    } else {
        console.log(`[PERFORMANCE RECORDS] No data found, is scores table empty? ...`);
    }
}