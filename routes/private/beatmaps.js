const express = require('express');
const moment = require('moment');
var apicache = require('apicache');
const { buildQuery } = require('../../helpers/inspector');
const { AltModdedStars, AltBeatmap, Databases } = require('../../helpers/db');
const { default: axios } = require('axios');
const { GetBeatmaps } = require('../../helpers/osualt');
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
    try {

        //let result = await connection.awaitQuery('SELECT * FROM beatmap WHERE beatmap_id=? AND mode=?', [req.params.id, mode]);
        let result = await AltBeatmap.findOne({
            where: {
                beatmap_id: req.params.id,
                mode: mode
            }
        });

        if (result !== null) {
            result = JSON.parse(JSON.stringify(result));
        }

        if (mods) {
            let res = {};
            const correctedMods = CorrectMod(parseInt(mods));

            const sr_result = await AltModdedStars.findOne({
                where: {
                    beatmap_id: req.params.id,
                    mods_enum: correctedMods
                }
            });
            res = { ...JSON.parse(JSON.stringify(sr_result)) };

            sr_results.forEach(sr => {
                const version = sr.version;
                res[version] = sr;
            });
            result.modded_sr = res;
        } else {
            const sr_result = await AltModdedStars.findAll({
                where: {
                    beatmap_id: req.params.id
                }
            });
            result.modded_sr = sr_result;
        }
        res.json(result);
    } catch (e) {
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

module.exports = router;
