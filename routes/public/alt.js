var apicache = require('apicache');
var express = require('express');
const moment = require("moment/moment");
const { InspectorUser, Databases, AltUser, AltScore, AltBeatmap } = require('../../helpers/db');
const { getFullUsers } = require('../../helpers/inspector');
const { Op } = require('sequelize');
var router = express.Router();

let cache = apicache.middleware;

let usableOptions = [
    {
        queryParam: 'approved',
        modelProperty: 'beatmaps.approved',
        type: 'array',
        validator: (value) => {
            return value.split(',').map(Number).every(Number.isInteger);
        },
        default: '1,2,4',
        comparator: 'in',
        get: (value) => {
            return value;
        }
    }, {
        queryParam: 'enabled_mods',
        modelProperty: 'scores.enabled_mods',
        type: 'array',
        validator: (value) => {
            return value.split(',').map(Number).every(Number.isInteger);
        },
        default: '',
        comparator: 'in',
        get: (value) => {
            return value.split(',').map(m => `'${m}'`).join(',');
        }
    }, {
        queryParam: 'approved_start',
        modelProperty: 'beatmaps.approved_date',
        type: 'date',
        validator: (value) => {
            return moment(value).isValid();
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, {
        queryParam: 'approved_end',
        modelProperty: 'beatmaps.approved_date',
        type: 'date',
        validator: (value) => {
            return moment(value).isValid();
        },
        default: undefined,
        comparator: '<=',
        get: (value) => {
            return `'${value}'`;
        }
    }, {
        queryParam: 'played_start',
        modelProperty: 'scores.date_played',
        type: 'date',
        validator: (value) => {
            return moment(value).isValid();
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, {
        queryParam: 'played_end',
        modelProperty: 'scores.date_played',
        type: 'date',
        validator: (value) => {
            return moment(value).isValid();
        },
        default: undefined,
        comparator: '<=',
        get: (value) => {
            return `'${value}'`;
        }
    }, {
        queryParam: 'length_min',
        modelProperty: 'beatmaps.length',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, {
        queryParam: 'length_max',
        modelProperty: 'beatmaps.length',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '<',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'ar_min',
        modelProperty: 'beatmaps.ar',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'ar_max',
        modelProperty: 'beatmaps.ar',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '<',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'cs_min',
        modelProperty: 'beatmaps.cs',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'cs_max',
        modelProperty: 'beatmaps.cs',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '<',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'od_min',
        modelProperty: 'beatmaps.od',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'od_max',
        modelProperty: 'beatmaps.od',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '<',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'hp_min',
        modelProperty: 'beatmaps.hp',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'hp_max',
        modelProperty: 'beatmaps.hp',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '<',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'pp_min',
        modelProperty: 'scores.pp',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'pp_max',
        modelProperty: 'scores.pp',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '<',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'accuracy_min',
        modelProperty: 'scores.accuracy',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'accuracy_max',
        modelProperty: 'scores.accuracy',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '<',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'combo_min',
        modelProperty: 'scores.combo',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'combo_max',
        modelProperty: 'scores.combo',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '<',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'maxcombo_min',
        modelProperty: 'beatmaps.maxcombo',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'maxcombo_max',
        modelProperty: 'beatmaps.maxcombo',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '<',
        get: (value) => {
            return `'${value}'`;
        }
    },
    {
        queryParam: 'stars_min',
        modelProperty: 'beatmaps.stars',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '>=',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
    {
        queryParam: 'stars_max',
        modelProperty: 'beatmaps.stars',
        type: 'number',
        validator: (value) => {
            return !isNaN(value);
        },
        default: undefined,
        comparator: '<',
        get: (value) => {
            return `'${value}'`;
        }
    }, 
];

function generateAndStatements(req) {
    const andAdditions = [];

    for (const option of usableOptions) {
        let value = req.query[option.queryParam] || option.default;
        if (value && option.validator(value)) {
            andAdditions.push(`${option.modelProperty} ${option.comparator} (${option.get(value)})`);
        } else if (value) {
            res.status(400).json({ error: `Invalid value for ${option.queryParam}` });
            return;
        }
    }

    return andAdditions;
}

router.get('/user/:id', cache('3 minutes'), async function (req, res, next) {
    const id = req.params.id;
    let osu_id = null;
    if (id === 'me') {
        const api_key = req.api_key;

        const owner = await InspectorUser.findOne({
            where: { api_key: api_key },
        });

        if (!owner) {
            res.status(401).json({ error: 'Something went wrong somehow' });
            return;
        }

        osu_id = owner.osu_id;
    } else {
        osu_id = id;
    }

    try {
        const andAdditions = generateAndStatements(req);

        const user = await AltUser.findOne({
            where: { user_id: osu_id },
        });

        const query = `
        SELECT
            count(*) as clears,
            count(case when scores.rank = 'X' then 1 end) as ss,
            count(case when scores.rank = 'XH' then 1 end) as ssh,
            count(case when scores.rank = 'S' then 1 end) as s,
            count(case when scores.rank = 'SH' then 1 end) as sh,
            count(case when scores.rank = 'A' then 1 end) as a,
            count(case when scores.rank = 'B' then 1 end) as b,
            count(case when scores.rank = 'C' then 1 end) as c,
            count(case when scores.rank = 'D' then 1 end) as d,
            sum(scores.pp) as total_pp,
            sum(scores.score) as total_score,
            sum(scores.count300+scores.count100+scores.count50) as total_hits,
            sum(beatmaps.length) as total_length,
            count(case when scores.perfect = '1' then 1 end) as perfect_clears,
            avg(scores.pp) as avg_pp,
            avg(scores.accuracy) as avg_acc
        FROM scores
        INNER JOIN beatmaps
        ON beatmaps.beatmap_id = scores.beatmap_id
        WHERE scores.user_id = ${osu_id}
        ${andAdditions.length > 0 ? `AND ${andAdditions.join(' AND ')}` : ''}
        `;

        const stats = (await Databases.osuAlt.query(query))[0][0];
        res.json({
            user: user,
            stats: stats,
            options: andAdditions,
        });
    } catch (err) {
        res.status(500).json({ error: 'Unable to get user', message: err.message });
    }
});

const SCORES_PER_PAGE = 1000;
router.get('/user/:id/scores', cache('10 minutes'), async function (req, res, next) {
    const id = req.params.id;
    let osu_id = null;
    if (id === 'me') {
        const api_key = req.api_key;

        const owner = await InspectorUser.findOne({
            where: { api_key: api_key },
        });

        if (!owner) {
            res.status(401).json({ error: 'Something went wrong somehow' });
            return;
        }

        osu_id = owner.osu_id;
    } else {
        osu_id = id;
    }

    try {
        const limit = Math.min(SCORES_PER_PAGE, parseInt(req.query.limit) || SCORES_PER_PAGE);
        const page = parseInt(req.query.page) || 1;
        const andAdditions = generateAndStatements(req);

        const user = await AltUser.findOne({
            where: { user_id: osu_id },
        });

        const queryScores = `
        SELECT * FROM scores
        INNER JOIN beatmaps
        ON beatmaps.beatmap_id = scores.beatmap_id
        WHERE scores.user_id = ${osu_id}
        ${andAdditions.length > 0 ? `AND ${andAdditions.join(' AND ')}` : ''}
        ORDER BY scores.date_played DESC
        LIMIT ${limit} 
        OFFSET ${(page - 1) * limit}
        `;

        const queryTotalScores = `
        SELECT count(*) as total FROM scores
        INNER JOIN beatmaps
        ON beatmaps.beatmap_id = scores.beatmap_id
        WHERE scores.user_id = ${osu_id}
        ${andAdditions.length > 0 ? `AND ${andAdditions.join(' AND ')}` : ''}
        `;

        const scores = (await Databases.osuAlt.query(queryScores))[0];
        const totalScores = parseInt((await Databases.osuAlt.query(queryTotalScores))[0][0].total);
        res.json({
            user: user,
            scores: scores,
            pagination: {
                limit: limit,
                page: page,
                total_scores: totalScores,
                total_pages: Math.ceil(totalScores / limit),
            },
            options: andAdditions,
        });
    } catch (err) {
        res.status(500).json({ error: 'Unable to get scores', message: err });
    }
});

module.exports = router;
