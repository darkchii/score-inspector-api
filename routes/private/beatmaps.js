const express = require('express');
const moment = require('moment');
var apicache = require('apicache');
const { buildQuery, getFullUsers } = require('../../helpers/inspector');
const { AltBeatmap, Databases, AltScore, InspectorBeatmapSongSource } = require('../../helpers/db');
const { default: axios } = require('axios');
const { GetBeatmaps } = require('../../helpers/osualt');
const { GetBeatmaps: GetOsuBeatmaps, ApplyDifficultyData } = require('../../helpers/osu');
const { Op, Sequelize } = require('sequelize');
const { CorrectMod } = require('../../helpers/misc');

const router = express.Router();
let cache = apicache.middleware;

const connConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
};

router.get('/packs', cache('1 hour'), async (req, res) => {
    try {
        let result = await Databases.osuAlt.query(`
            SELECT pack_id, count(*) as count from beatmap_packs 
            inner join beatmaps on beatmaps.beatmap_id=beatmap_packs.beatmap_id 
            where beatmaps.mode=0 and pack_id!='-1'
            group by pack_id`);

        res.json(result?.[0] ?? []);
    } catch (e) {
        res.json([]);
    }
});

router.get('/pack_details', cache('24 hours'), async (req, res) => {
    try {
        let result = await axios.get(`https://osu.ppy.sh/api/get_packs?k=${process.env.OSU_APIV1}`, {
            headers: { "Accept-Encoding": "gzip,deflate,compress" }
        });

        res.json(result?.data ?? []);
    } catch (e) {
        res.json([]);
    }
});

router.get('/count', cache('1 hour'), async (req, res) => {
    try {
        const _res = buildQuery(req.query);
        const q = _res[0];
        const qVar = _res[1];

        const result = await Databases.osuAlt.query(`SELECT COUNT(*) as amount FROM beatmaps ${q}`, {
            replacements: qVar,
            type: Sequelize.QueryTypes.SELECT
        });

        res.json(result[0].amount);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/all', cache('1 hour'), async (req, res) => {
    try {
        const result = await GetBeatmaps(req.query);
        res.json(result);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/count_periodic', cache('1 hour'), async (req, res) => {
    try {
        const mode = req.query.mode !== undefined ? req.query.mode : 0;
        const periods = ['y', 'm', 'd'];

        let result = {};

        for await (const period of periods) {
            let formatting = 'yyyy-mm';
            if (period === 'y') {
                formatting = 'yyyy';
            } else if (period === 'd') {
                formatting = 'yyyy-mm-dd';
            } else if (period === 'm') {
                formatting = 'yyyy-mm';
            }

            //pgsql, date_format is not supported
            // GROUP BY DATE_FORMAT(approved_date, '${formatting}') should be GROUP BY DATE_TRUNC('${formatting}', approved_date)
            const query = `
        SELECT 
        to_char(approved_date, '${formatting}') as date,
        SUM(length) as length, 
        SUM(top_score) as score, 
        COUNT(*) as amount
        FROM beatmaps 
        INNER JOIN top_score ON beatmaps.beatmap_id=top_score.beatmap_id
        WHERE mode=? AND (approved=1 OR approved=2 ${(req.query.include_loved === 'true' ? 'OR approved=4' : '')}) 
        GROUP BY to_char(approved_date, '${formatting}')`;
            // const data = await connection.awaitQuery(query, [mode]);
            const data = await Databases.osuAlt.query(query, {
                replacements: [mode],
                type: Sequelize.QueryTypes.SELECT
            });

            const _data = JSON.parse(JSON.stringify(data));

            //order by date
            _data.sort((a, b) => {
                return new Date(a.date) - new Date(b.date);
            });

            for (let i = 0; i < _data.length; i++) {
                let current = _data[i];
                let previous = _data[i - 1];

                current.length = parseInt(current.length);
                current.score = parseInt(current.score);
                current.amount = parseInt(current.amount);

                current.length_total = parseInt(previous?.length_total ?? 0) + parseInt(current.length);
                current.score_total = parseInt(previous?.score_total ?? 0) + parseInt(current.score);
                current.amount_total = parseInt(previous?.amount_total ?? 0) + parseInt(current.amount);
            }

            result[period] = _data;
        };

        res.json(result);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/:id', cache('1 hour'), async (req, res) => {
    const mode = req.query.mode !== undefined ? req.query.mode : 0;
    const mods = req.query.mods_enum !== undefined ? req.query.mods_enum : null;
    const include_scores = req.query.include_scores !== undefined ? req.query.include_scores : false;
    const include_score_data = req.query.include_score_data !== undefined ? req.query.include_score_data : false;
    const score_limit = req.query.score_limit !== undefined ? req.query.score_limit : 10;
    const include_remote_data = req.query.include_remote_data !== undefined ? req.query.include_remote_data : false;
    try {

        //let result = await connection.awaitQuery('SELECT * FROM beatmap WHERE beatmap_id=? AND mode=?', [req.params.id, mode]);
        let result = await AltBeatmap.findOne({
            where: {
                beatmap_id: req.params.id,
            }
        });

        if (result !== null) {
            result = JSON.parse(JSON.stringify(result));
        }

        if (mods) {
            result = (await ApplyDifficultyData([result], false, mods))[0];
        } else {
            result = (await ApplyDifficultyData([result], true))[0];
        }

        const set_id = result.set_id;
        const set = await AltBeatmap.findAll({
            attributes: ['beatmap_id', 'diffname', 'stars', 'mode'],
            where: {
                set_id: set_id
            }
        });

        const creator_id = result.creator_id;
        const creator = await getFullUsers([creator_id], {
            alt: true,
            score: true,
            extras: true
        });

        result.creator_obj = creator[0] ?? null;

        //order by stars and mode
        result.set = set.sort((a, b) => {
            return a.stars - b.stars;
        }).sort((a, b) => {
            return a.mode - b.mode;
        });

        if (include_scores) {
            const scores = await AltScore.findAll({
                where: {
                    beatmap_id: req.params.id
                },
                limit: score_limit,
                order: [
                    ['score', 'DESC']
                ]
            });

            result.scores = scores;
        }

        if (include_score_data) {
            const score_count = await AltScore.count({ where: { beatmap_id: req.params.id } });

            result.score_data = {
                scores: score_count
            }
        }

        if (include_remote_data) {
            const remote_beatmap_data = await GetOsuBeatmaps([req.params.id]);
            result.remote_data = remote_beatmap_data?.beatmaps?.[0] ?? null;

            if (!result.remote_data) {
                throw new Error('No remote data found');
            }

            const beatmap_mapper_id = result.remote_data.user_id;
            const beatmap_mapper = await getFullUsers([beatmap_mapper_id], {
                alt: true,
                score: true,
                extras: true
            });
            result.remote_data.creator_obj = beatmap_mapper[0] ?? null;
        }

        //get beatmap song sources
        const song_sources = await InspectorBeatmapSongSource.findAll({
            where: {
                beatmapset_id: set_id
            }
        });

        result.sources = song_sources;

        res.json(result);
    } catch (e) {
        console.error(e);
        res.json([]);
    }
});

router.get('/:id/maxscore', cache('1 hour'), async (req, res) => {
    try {
        const mode = req.query.mode !== undefined ? req.query.mode : 0;

        // const result = await connection.awaitQuery('SELECT max_score FROM beatmap WHERE beatmap_id=? AND mode=?', [req.params.id, mode]);

        const result = await Databases.osuAlt.query('SELECT top_score FROM top_score WHERE beatmap_id=?', {
            replacements: [req.params.id],
            type: Sequelize.QueryTypes.SELECT
        });

        res.json((result !== undefined && result[0] !== undefined) ? result[0].top_score : 0);
    } catch (e) {
        res.json([]);
    }
});

router.get('/:id/trend', cache('4 hours'), async (req, res) => {
    try {
        const mode = req.query.mode !== undefined ? req.query.mode : 0;

        if (mode !== 0) {
            throw new Error('Mode not supported');
        }

        //get amount of scores for every day for the beatmap (utc)
        const result = await Databases.osuAlt.query(`
        SELECT
        date_trunc('day', date_played) as date,
        COUNT(*) as amount
        FROM scores
        WHERE scores.beatmap_id=?
        GROUP BY date_trunc('day', date_played)
        `, {
            replacements: [req.params.id],
            type: Sequelize.QueryTypes.SELECT
        });

        //order by date
        result.sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });

        //fill in missing dates with 0
        let _result = [];
        let current = moment(result[0].date);
        let end = moment(result[result.length - 1].date);

        while (current <= end) {
            let found = result.find(x => moment(x.date).isSame(current));

            if (found === undefined) {
                _result.push({
                    date: current.format('YYYY-MM-DD'),
                    amount: 0
                });
            } else {
                _result.push(found);
            }

            current.add(1, 'days');
        }

        res.json(_result);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

module.exports = router;
