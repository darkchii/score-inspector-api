const { Client } = require("pg");
const { GetUser, GetDailyUser } = require("./osu");
const mysql = require('mysql-await');
const { default: axios } = require("axios");
require('dotenv').config();

const connConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
};

module.exports.buildQuery = buildQuery;
function buildQuery(req) {
    const mode = req.mode !== undefined ? req.mode : 0;
    let q = `WHERE mode=? AND (approved=1 OR approved=2${(req.include_qualified !== undefined && req.include_qualified === 'true') ? ' OR approved=3' : ''}${(req.include_loved !== undefined && req.include_loved === 'true') ? ' OR approved=4' : ''})`;
    const qVar = [mode];

    if (req.stars_min) {
        q += ' AND star_rating>=?';
        qVar.push(req.stars_min);
    }
    if (req.stars_max) {
        q += ' AND star_rating<?';
        qVar.push(req.stars_max);
    }
    if (req.ar_min) {
        q += ' AND ar>=?';
        qVar.push(req.ar_min);
    }
    if (req.ar_max) {
        q += ' AND ar<?';
        qVar.push(req.ar_max);
    }
    if (req.od_min) {
        q += ' AND od>=?';
        qVar.push(req.od_min);
    }
    if (req.od_max) {
        q += ' AND od<?';
        qVar.push(req.od_max);
    }
    if (req.cs_min) {
        q += ' AND cs>=?';
        qVar.push(req.cs_min);
    }
    if (req.cs_max) {
        q += ' AND cs<?';
        qVar.push(req.cs_max);
    }
    if (req.hp_min) {
        q += ' AND hp>=?';
        qVar.push(req.hp_min);
    }
    if (req.hp_max) {
        q += ' AND hp<?';
        qVar.push(req.hp_max);
    }
    if (req.length_min) {
        q += ' AND total_length>=?';
        qVar.push(req.length_min);
    }
    if (req.length_max) {
        q += ' AND total_length<?';
        qVar.push(req.length_max);
    }
    if (req.pack) {
        q += ` AND 
      (packs LIKE '${req.pack},%' or packs LIKE '%,${req.pack},%' or packs LIKE '%,${req.pack}' or packs = '${req.pack}')
    `;
    }
    if (req.id) {
        const id_arr = req.id;
        if (id_arr.length > 0) {
            q += ` AND ${req.isSetID ? 'beatmapset_id' : 'beatmap_id'} IN (`;
            for (let i = 0; i < id_arr.length; i++) {
                if (i > 0) q += ',';
                q += '?';
                qVar.push(id_arr[i]);
            }
            q += ')';
        }
    }

    return [q, qVar];
}

module.exports.getBeatmaps = getBeatmaps;
async function getBeatmaps(req) {
    const connection = mysql.createConnection(connConfig);
    const _res = buildQuery(req);
    const q = _res[0];
    const qVar = _res[1];

    let querySelector = `*`;

    if (req.compact) {
        querySelector = 'beatmapset_id, beatmap_id, artist, title, version, approved';
    }

    const result = await connection.awaitQuery(`SELECT ${querySelector} FROM beatmap ${q}`, qVar);
    await connection.end();
    return result;
}

module.exports.IsReachable = IsReachable;
async function IsReachable(endpoint) {
    let reachable = false;

    switch (endpoint) {
        case 'osudaily':
            try {
                const data = await GetDailyUser(10153735, 0, 'id', 1000);
                if (data?.osu_id == 10153735) reachable = true;
            } catch (e) { }
            break;
        case 'scorerank':
            try {
                const data = await axios.get('https://score.respektive.pw/u/10153735', { timeout: 1000 });
                if (data?.data?.[0] !== null) reachable = true;
            } catch (e) { }
            break;
        case 'beatmaps':
            try {
                const connection = mysql.createConnection(connConfig);
                connection.on('error', (err) => { });
                const result = await connection.awaitQuery(`SELECT count(*) FROM beatmap`);
                if (result?.[0]?.['count(*)'] > 0) reachable = true;
                await connection.end();
            } catch (e) { }
            break;
        case 'osuv2':
            try {
                const test_user = await GetUser('peppy', 'osu', 'username', 1000);
                if (test_user?.id == 2) reachable = true;
            } catch (e) { }
            break;
        case 'osualt':
            try {
                const client = new Client({
                    query_timeout: 1000,
                    connectionTimeoutMillis: 1000,
                    statement_timeout: 1000,
                    user: process.env.ALT_DB_USER,
                    host: process.env.ALT_DB_HOST,
                    database: process.env.ALT_DB_DATABASE,
                    password: process.env.ALT_DB_PASSWORD,
                    port: process.env.ALT_DB_PORT
                });
                await client.connect();
                const res = await client.query('SELECT 1');
                await client.end();
                if (res.rowCount > 0) reachable = true;
            } catch (err) {
            }
            break;
    }
    return reachable;
}

module.exports.GetBeatmapCount = GetBeatmapCount;
async function GetBeatmapCount(loved = true) {
    let req = {
        query: {}
    };
    if (loved) {
        req.query.include_loved = true;
    }
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

    return result?.[0]?.amount;
}