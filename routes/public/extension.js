var apicache = require('apicache');
var express = require('express');
const { AltUser, Databases } = require('../../helpers/db.js');
const { default: rateLimit } = require('express-rate-limit');
var router = express.Router();

const limiter = rateLimit({
    windowMs: 5 * 1000, // 15 minutes
    max: 120, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

let cache = apicache.middleware;

router.get('/user/:id', limiter, cache('3 minutes'), async function (req, res, next) {
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
