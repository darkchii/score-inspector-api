const express = require('express');
const moment = require('moment');
const mysql = require('mysql-await');
var apicache = require('apicache');
const { buildQuery } = require('../../helpers/inspector');
const { AltModdedStars, AltBeatmap, AltBeatmapPack, Databases, InspectorModdedStars } = require('../../helpers/db');
const { default: axios } = require('axios');
const { GetBeatmaps } = require('../../helpers/osualt');
const { Op, Sequelize } = require('sequelize');
const { CorrectedSqlScoreMods, CorrectedSqlScoreModsCustom, CorrectMod } = require('../../helpers/misc');

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
        console.error(e);
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
        console.error(e);
        res.json([]);
    }
});

router.get('/max_playcount', cache('1 hour'), async (req, res) => {
    try {
        let result = await Databases.osuAlt.query(`
            SELECT set_id, mode, MAX(playcount) AS max_playcount FROM beatmaps GROUP BY set_id, mode
        `);

        res.json(result?.[0] ?? []);
    } catch (e) {
        console.error(e);
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

        await connection.end();
    } catch (e) {
        console.error(e);
        res.status(500).json([]);
    }
});

router.get('/stats', cache('1 hour'), async (req, res) => {
    try {
        const _res = buildQuery(req);
        const q = _res[0];
        const qVar = _res[1];

    //     const misc = await connection.awaitQuery(`SELECT 
    // count(*) as amount,
    // count(case when (approved = 1 or approved = 2) and mode = 0 then 1 end) as ranked,
    // count(case when approved = 4 and mode = 0 then 1 end) as loved
    // FROM beatmap ${q}`, qVar);

    //     const minmax_length = await connection.awaitQuery('SELECT "Length" as name, 0 as rounding, min(length) as min, avg(total_length) as avg, max(total_length) as max FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0');
    //     const minmax_stars = await connection.awaitQuery('SELECT "Starrating" as name, 2 as rounding, min(stars) as min, avg(stars) as avg, max(stars) as max FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0');
    //     const minmax_combo = await connection.awaitQuery('SELECT "Combo" as name, 0 as rounding, min(max_combo) as min, avg(max_combo) as avg, max(max_combo) as max FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0');
    //     const minmax_hit_objects = await connection.awaitQuery('SELECT "Hit Objects" as name, 0 as rounding, min(hit_objects) as min, avg(hit_objects) as avg, max(hit_objects) as max FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0');
    //     const minmax_bpm = await connection.awaitQuery('SELECT "BPM" as name, min(bpm) as min, 0 as rounding, avg(bpm) as avg, max(bpm) as max FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0');

    //     const most_played_beatmaps = await connection.awaitQuery('SELECT *, sum(plays) as plays, count(beatmapset_id) as diffcount FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0 GROUP BY beatmapset_id ORDER BY plays DESC LIMIT 10');
    //     const newest_maps = await connection.awaitQuery('SELECT *, count(beatmapset_id) as diffcount FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0 GROUP BY beatmapset_id ORDER BY approved_date DESC LIMIT 10');
    //     const longest_rank_time = await connection.awaitQuery('SELECT *, count(beatmapset_id) as diffcount FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0 GROUP BY beatmapset_id ORDER BY (approved_date-submitted_date) DESC LIMIT 10');

        // const misc = await Databases.osuAlt.query(`SELECT
        // count(*) as amount,
        // count(case when ((approved = 1 or approved = 2) and mode = 0) then 1 else 0 end) as ranked,
        // count(case when (approved = 4 and mode = 0) then 1 else 0 end) as loved
        // FROM beatmaps ${q}`, {
        //     replacements: qVar,
        //     type: Sequelize.QueryTypes.SELECT
        // });
        const misc = {};
        misc.ranked = await AltBeatmap.count({ where: { [Op.and]: [ { approved: { [Op.or]: [1, 2] } }, { mode: 0 } ] } });
        misc.loved = await AltBeatmap.count({ where: { [Op.and]: [ { approved: 4 }, { mode: 0 } ] } });
        misc.amount = await AltBeatmap.count({ where: { mode: 0 } });

        const minmax_length = await Databases.osuAlt.query('SELECT 0 as rounding, min(length) as min, avg(length) as avg, max(length) as max FROM beatmaps WHERE (approved=1 OR approved=2) AND mode=0', { type: Sequelize.QueryTypes.SELECT });
        const minmax_stars = await Databases.osuAlt.query('SELECT 2 as rounding, min(stars) as min, avg(stars) as avg, max(stars) as max FROM beatmaps WHERE (approved=1 OR approved=2) AND mode=0', { type: Sequelize.QueryTypes.SELECT });
        const minmax_combo = await Databases.osuAlt.query('SELECT 0 as rounding, min(maxcombo) as min, avg(maxcombo) as avg, max(maxcombo) as max FROM beatmaps WHERE (approved=1 OR approved=2) AND mode=0', { type: Sequelize.QueryTypes.SELECT });
        const minmax_hit_objects = await Databases.osuAlt.query('SELECT 0 as rounding, min(circles+spinners+sliders) as min, avg(circles+spinners+sliders) as avg, max(circles+spinners+sliders) as max FROM beatmaps WHERE (approved=1 OR approved=2) AND mode=0', { type: Sequelize.QueryTypes.SELECT });
        const minmax_bpm = await Databases.osuAlt.query('SELECT min(bpm) as min, 0 as rounding, avg(bpm) as avg, max(bpm) as max FROM beatmaps WHERE (approved=1 OR approved=2) AND mode=0', { type: Sequelize.QueryTypes.SELECT });

        const most_played_beatmaps = await Databases.osuAlt.query('SELECT *, sum(playcount) as plays, count(set_id) as diffcount FROM beatmaps WHERE (approved=1 OR approved=2) AND mode=0 GROUP BY set_id,beatmap_id ORDER BY plays DESC LIMIT 10', { type: Sequelize.QueryTypes.SELECT });
        const newest_maps = await Databases.osuAlt.query('SELECT *, count(set_id) as diffcount FROM beatmaps WHERE (approved=1 OR approved=2) AND mode=0 GROUP BY set_id,beatmap_id ORDER BY approved_date DESC LIMIT 10', { type: Sequelize.QueryTypes.SELECT });
        const longest_rank_time = await Databases.osuAlt.query('SELECT *, count(set_id) as diffcount FROM beatmaps WHERE (approved=1 OR approved=2) AND mode=0 GROUP BY set_id,beatmap_id ORDER BY (approved_date-submit_date) DESC LIMIT 10', { type: Sequelize.QueryTypes.SELECT });

        minmax_length[0].name = 'Length';
        minmax_stars[0].name = 'Starrating';
        minmax_combo[0].name = 'Combo';
        minmax_hit_objects[0].name = 'Hit Objects';
        minmax_bpm[0].name = 'BPM';

        const data = {
            misc: misc,
            minmax: {
                length: minmax_length[0],
                stars: minmax_stars[0],
                combo: minmax_combo[0],
                hit_objects: minmax_hit_objects[0],
                bpm: minmax_bpm[0]
            },
            most_played_beatmaps,
            newest_maps,
            longest_rank_time
        };

        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json([]);
    }
});

router.get('/all', cache('1 hour'), async (req, res) => {
    try {
        const result = await GetBeatmaps(req.query);
        res.json(result);
    } catch (e) {
        console.error(e);
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
        WHERE mode=? AND (approved=1 OR approved=2 ${(req.query.loved === 'true' ? 'OR approved=4' : '')}) 
        GROUP BY to_char(approved_date, '${formatting}')`;
            // const data = await connection.awaitQuery(query, [mode]);
            const data = await Databases.osuAlt.query(query, {
                replacements: [mode],
                type: Sequelize.QueryTypes.SELECT
            });

            const _data = JSON.parse(JSON.stringify(data));

            for (let i = 0; i < _data.length; i++) {
                let current = _data[i];
                let previous = _data[i - 1];

                current.length = parseInt(current.length);
                current.score = parseInt(current.score);
                current.amount = parseInt(current.amount);

                if (previous === undefined) {
                    current.length_total = parseInt(current.length);
                    current.score_total = parseInt(current.score);
                    current.amount_total = parseInt(current.amount);
                } else {
                    current.length_total = parseInt(current.length) + parseInt(previous.length_total);
                    current.score_total = parseInt(current.score) + parseInt(previous.score_total);
                    current.amount_total = parseInt(current.amount) + parseInt(previous.amount_total);
                }
            }

            result[period] = _data;
        };

        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json([]);
    }
});

router.get('/monthly', cache('1 hour'), async (req, res) => {
    try {
        const mode = req.query.mode !== undefined ? req.query.mode : 0;

        const months = [];

        const _start = moment('10-06-2007', "MM-DD-YYYY");
        // var _end = moment(sorted[sorted.length - 1].actual_date).add(1, `${addDateFormat}s`);
        const _end = moment().add(1, 'months');
        for (let m = moment(_start); m.isBefore(_end); m.add(1, 'months')) {
            months.push(moment(m));
        }

        const query = `
            SELECT EXTRACT(month from approved_date) as month, EXTRACT(year from approved_date) as year, SUM(length) as length, SUM(top_score) as score, COUNT(*) as amount 
            FROM beatmaps 
            INNER JOIN top_score ON beatmaps.beatmap_id=top_score.beatmap_id
            WHERE mode=? AND (approved=1 OR approved=2 ${(req.query.loved === 'true' ? 'OR approved=4' : '')}) 
            GROUP BY EXTRACT(year from approved_date), EXTRACT(month from approved_date)`;
        // const result = await connection.awaitQuery(query, [mode]);
        const result = await Databases.osuAlt.query(query, {
            replacements: [mode],
            type: Sequelize.QueryTypes.SELECT
        });
        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json([]);
    }
});

router.get('/yearly', cache('1 hour'), async (req, res) => {
    try {
        const mode = req.query.mode !== undefined ? req.query.mode : 0;

        const months = [];

        const _start = moment('10-06-2007', "MM-DD-YYYY");
        // var _end = moment(sorted[sorted.length - 1].actual_date).add(1, `${addDateFormat}s`);
        const _end = moment().add(1, 'years');
        for (let m = moment(_start); m.isBefore(_end); m.add(1, 'years')) {
            months.push(moment(m));
        }
        const query = `
        SELECT EXTRACT(year from approved_date) as year, SUM(length) as length, SUM(top_score) as score, COUNT(*) as amount 
        FROM beatmaps 
        INNER JOIN top_score ON beatmaps.beatmap_id=top_score.beatmap_id
        WHERE mode=? AND (approved=1 OR approved=2 ${(req.query.loved === 'true' ? 'OR approved=4' : '')}) 
        GROUP BY EXTRACT(year from approved_date)`;
        const result = await Databases.osuAlt.query(query, {
            replacements: [mode],
            type: Sequelize.QueryTypes.SELECT
        });

        res.json(result);
    } catch (e) {
        console.error(e);
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

            const sr_results = await InspectorModdedStars.findAll({
                where: {
                    beatmap_id: req.params.id,
                    mods: correctedMods
                }
            });

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
        console.error(e);
        res.json([]);
    }
});

router.get('/ranges/:format', cache('1 hour'), async (req, res) => {
    try {
        const connection = mysql.createConnection(connConfig);

        connection.on('error', (err) => {
            res.json({
                message: 'Unable to connect to database',
                error: err,
            });
        });

        const _res = buildQuery(req);
        const q = _res[0];
        const qVar = _res[1];
        const size = req.query.size !== undefined ? req.query.size : 1;

        const result = await connection.awaitQuery(`select (bucket*${size}) as min, ((bucket*${size})+${size}) as max, count(${req.params.format}) as amount from (select *, floor(${req.params.format}/${size}) as bucket from beatmap ${q}) t1 group by bucket`, [qVar]);
        res.json(result);

        await connection.end();
    } catch (e) {
        console.error(e);
        res.json([]);
    }
});

module.exports = router;
