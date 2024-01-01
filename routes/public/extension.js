var apicache = require('apicache');
var express = require('express');
const { AltUser, Databases } = require('../../helpers/db.js');
var router = express.Router();

let cache = apicache.middleware;

router.get('/user/:id', cache('3 minutes'), async function (req, res, next) {
    const id = req.params.id;
    try {
        const user = await AltUser.findOne({
            where: { user_id: id },
        });

        const query = `
        SELECT
            count(*) as clears,
            count(case when scores.rank = 'B' then 1 end) as b,
            count(case when scores.rank = 'C' then 1 end) as c,
            count(case when scores.rank = 'D' then 1 end) as d
        FROM scores
        INNER JOIN beatmaps
        ON beatmaps.beatmap_id = scores.beatmap_id
        WHERE scores.user_id = ${id}
        `;

        const stats = (await Databases.osuAlt.query(query))[0][0];
        res.json({
            user: user,
            stats: stats,
        });
    } catch (err) {
        res.status(500).json({ error: 'Unable to get user', message: err.message });
    }
});

module.exports = router;
