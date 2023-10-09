const express = require('express');
const moment = require('moment');
const mysql = require('mysql-await');
var apicache = require('apicache');
const rateLimit = require('express-rate-limit');
const { buildQuery } = require('../../helpers/inspector');
const { AltModdedStars, AltBeatmap, AltBeatmapPack, Databases } = require('../../helpers/db');
const { default: axios } = require('axios');
const { GetBeatmaps } = require('../../helpers/osualt');

const router = express.Router();
let cache = apicache.middleware;

const limiter = rateLimit({
    windowMs: 60 * 1000, // 15 minutes
    max: 60, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const connConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
};

router.get('/packs', limiter, cache('1 hour'), async (req, res) => {
    let result = await Databases.osuAlt.query(`
        SELECT pack_id, count(*) as count from beatmap_packs 
        inner join beatmaps on beatmaps.beatmap_id=beatmap_packs.beatmap_id 
        where beatmaps.mode=0 and pack_id!='-1'
        group by pack_id`);

    res.json(result?.[0] ?? []);
});

router.get('/pack_details', limiter, cache('24 hours'), async (req, res) => {
    let result = await axios.get(`https://osu.ppy.sh/api/get_packs?k=${process.env.OSU_APIV1}`, {
        headers: { "Accept-Encoding": "gzip,deflate,compress" } 
    });

    res.json(result?.data ?? []);
});

router.get('/max_playcount', limiter, cache('1 hour'), async (req, res) => {
    let result = await Databases.osuAlt.query(`
        SELECT set_id, mode, MAX(playcount) AS max_playcount FROM beatmaps GROUP BY set_id, mode
    `);

    res.json(result?.[0] ?? []);
});

router.get('/count', limiter, cache('1 hour'), async (req, res) => {
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

    const result = await connection.awaitQuery(`SELECT COUNT(*) as amount FROM beatmap ${q}`, qVar);

    res.json(result[0].amount);

    await connection.end();
});

router.get('/stats', limiter, cache('1 hour'), async (req, res) => {
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

    const misc = await connection.awaitQuery(`SELECT 
    count(*) as amount,
    count(case when (approved = 1 or approved = 2) and mode = 0 then 1 end) as ranked,
    count(case when approved = 4 and mode = 0 then 1 end) as loved
    FROM beatmap ${q}`, qVar);

    const minmax_length = await connection.awaitQuery('SELECT "Length" as name, 0 as rounding, min(total_length) as min, avg(total_length) as avg, max(total_length) as max FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0');
    const minmax_stars = await connection.awaitQuery('SELECT "Starrating" as name, 2 as rounding, min(star_rating) as min, avg(star_rating) as avg, max(star_rating) as max FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0');
    const minmax_combo = await connection.awaitQuery('SELECT "Combo" as name, 0 as rounding, min(max_combo) as min, avg(max_combo) as avg, max(max_combo) as max FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0');
    const minmax_hit_objects = await connection.awaitQuery('SELECT "Hit Objects" as name, 0 as rounding, min(hit_objects) as min, avg(hit_objects) as avg, max(hit_objects) as max FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0');
    const minmax_bpm = await connection.awaitQuery('SELECT "BPM" as name, min(bpm) as min, 0 as rounding, avg(bpm) as avg, max(bpm) as max FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0');

    const most_played_beatmaps = await connection.awaitQuery('SELECT *, sum(plays) as plays, count(beatmapset_id) as diffcount FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0 GROUP BY beatmapset_id ORDER BY plays DESC LIMIT 10');
    const newest_maps = await connection.awaitQuery('SELECT *, count(beatmapset_id) as diffcount FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0 GROUP BY beatmapset_id ORDER BY approved_date DESC LIMIT 10');
    const longest_rank_time = await connection.awaitQuery('SELECT *, count(beatmapset_id) as diffcount FROM beatmap WHERE (approved=1 OR approved=2) AND mode=0 GROUP BY beatmapset_id ORDER BY (approved_date-submitted_date) DESC LIMIT 10');

    const data = {
        misc: misc[0],
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

    await connection.end();
});

router.get('/all', limiter, cache('1 hour'), async (req, res) => {
    const result = await GetBeatmaps(req.query);
    res.json(result);
});

router.get('/allsets', limiter, cache('1 hour'), async (req, res) => {
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

    const result = await connection.awaitQuery(`SELECT approved, max(total_length) as total_length, max(hit_length) as hit_length, beatmapset_id, artist, title, creator, creator_id, max(approved_date) as approved_date, tags, packs FROM beatmap ${q} GROUP BY beatmapset_id`, qVar);

    res.json(result);

    await connection.end();
});

router.get('/monthly', limiter, cache('1 hour'), async (req, res) => {
    const connection = mysql.createConnection(connConfig);
    const mode = req.query.mode !== undefined ? req.query.mode : 0;

    connection.on('error', (err) => {
        res.json({
            message: 'Unable to connect to database',
            error: err,
        });
    });

    const months = [];

    const _start = moment('10-06-2007', "MM-DD-YYYY");
    // var _end = moment(sorted[sorted.length - 1].actual_date).add(1, `${addDateFormat}s`);
    const _end = moment().add(1, 'months');
    for (let m = moment(_start); m.isBefore(_end); m.add(1, 'months')) {
        months.push(moment(m));
    }

    const query = 'SELECT MONTH(approved_date) as month, YEAR(approved_date) as year, SUM(total_length) as length, SUM(max_score) as score, COUNT(*) as amount FROM beatmap WHERE mode=? AND (approved=1 OR approved=2 ' + (req.query.loved === 'true' ? 'OR approved=4' : '') + ') GROUP BY YEAR(approved_date), MONTH(approved_date)';
    const result = await connection.awaitQuery(query, [mode]);
    console.log(query);
    res.json(result);

    await connection.end();
});

router.get('/yearly', limiter, cache('1 hour'), async (req, res) => {
    const connection = mysql.createConnection(connConfig);
    const mode = req.query.mode !== undefined ? req.query.mode : 0;

    connection.on('error', (err) => {
        res.json({
            message: 'Unable to connect to database',
            error: err,
        });
    });

    const months = [];

    const _start = moment('10-06-2007', "MM-DD-YYYY");
    // var _end = moment(sorted[sorted.length - 1].actual_date).add(1, `${addDateFormat}s`);
    const _end = moment().add(1, 'years');
    for (let m = moment(_start); m.isBefore(_end); m.add(1, 'years')) {
        months.push(moment(m));
    }

    const result = await connection.awaitQuery('SELECT YEAR(approved_date) as year, SUM(total_length) as length, SUM(max_score) as score, COUNT(*) as amount FROM beatmap WHERE mode=? AND (approved=1 OR approved=2) GROUP BY YEAR(approved_date)', [mode]);

    res.json(result);

    await connection.end();
});

router.get('/:id', limiter, cache('1 hour'), async (req, res) => {
    const mode = req.query.mode !== undefined ? req.query.mode : 0;
    try{

        //let result = await connection.awaitQuery('SELECT * FROM beatmap WHERE beatmap_id=? AND mode=?', [req.params.id, mode]);
        let result = await AltBeatmap.findOne({
            where: {
                beatmap_id: req.params.id,
                mode: mode
            }
        });

        if(result !== null){
            result = JSON.parse(JSON.stringify(result));
        }
    
        const sr_result = await AltModdedStars.findAll({
            where: {
                beatmap_id: req.params.id
            }
        });
        result.modded_sr = sr_result;
        res.json(result);
    }catch(e){
        console.error(e);
        res.json([]);
    }
});

router.get('/:id/maxscore', limiter, cache('1 hour'), async (req, res) => {
    const connection = mysql.createConnection(connConfig);
    const mode = req.query.mode !== undefined ? req.query.mode : 0;

    connection.on('error', (err) => {
        res.json({
            message: 'Unable to connect to database',
            error: err,
        });
    });

    const result = await connection.awaitQuery('SELECT max_score FROM beatmap WHERE beatmap_id=? AND mode=?', [req.params.id, mode]);

    res.json((result !== undefined && result[0] !== undefined) ? result[0].max_score : 0);
    connection.end();
});

router.get('/ranges/:format', limiter, cache('1 hour'), async (req, res) => {
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
});

module.exports = router;
