const { Client } = require("pg");
const { GetUser, GetDailyUser } = require("./osu");
const mysql = require('mysql-await');
const { default: axios } = require("axios");
const { range } = require("./misc");
const { InspectorToken, InspectorBeatmap, Databases, AltBeatmap } = require("./db");
const { Op, Sequelize } = require("sequelize");
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
    let q = `WHERE mode=? AND approved IN (1,2${(req.include_qualified !== undefined && req.include_qualified === 'true') ? ',3' : ''}${(req.include_loved !== undefined && req.include_loved === 'true') ? ',4' : ''})`;
    const qVar = [mode];
    let requiredAttributes = [];

    if (req.stars_min) {
        q += ' AND star_rating>=?';
        qVar.push(req.stars_min);

        if(!requiredAttributes.includes('star_rating')) requiredAttributes.push('star_rating');
    }
    if (req.stars_max) {
        q += ' AND star_rating<?';
        qVar.push(req.stars_max);
        if(!requiredAttributes.includes('star_rating')) requiredAttributes.push('star_rating');
    }
    if (req.ar_min) {
        q += ' AND ar>=?';
        qVar.push(req.ar_min);
        if(!requiredAttributes.includes('ar')) requiredAttributes.push('ar');
    }
    if (req.ar_max) {
        q += ' AND ar<?';
        qVar.push(req.ar_max);
        if(!requiredAttributes.includes('ar')) requiredAttributes.push('ar');
    }
    if (req.od_min) {
        q += ' AND od>=?';
        qVar.push(req.od_min);
        if(!requiredAttributes.includes('od')) requiredAttributes.push('od');
    }
    if (req.od_max) {
        q += ' AND od<?';
        qVar.push(req.od_max);
        if(!requiredAttributes.includes('od')) requiredAttributes.push('od');
    }
    if (req.cs_min) {
        q += ' AND cs>=?';
        qVar.push(req.cs_min);
        if(!requiredAttributes.includes('cs')) requiredAttributes.push('cs');
    }
    if (req.cs_max) {
        q += ' AND cs<?';
        qVar.push(req.cs_max);
        if(!requiredAttributes.includes('cs')) requiredAttributes.push('cs');
    }
    if (req.hp_min) {
        q += ' AND hp>=?';
        qVar.push(req.hp_min);
        if(!requiredAttributes.includes('hp')) requiredAttributes.push('hp');
    }
    if (req.hp_max) {
        q += ' AND hp<?';
        qVar.push(req.hp_max);
        if(!requiredAttributes.includes('hp')) requiredAttributes.push('hp');
    }
    if (req.length_min) {
        q += ' AND total_length>=?';
        qVar.push(req.length_min);
        if(!requiredAttributes.includes('total_length')) requiredAttributes.push('total_length');
    }
    if (req.length_max) {
        q += ' AND total_length<?';
        qVar.push(req.length_max);
        if(!requiredAttributes.includes('total_length')) requiredAttributes.push('total_length');
    }
    if (req.pack) {
        q += ` AND 
      (packs LIKE '${req.pack},%' or packs LIKE '%,${req.pack},%' or packs LIKE '%,${req.pack}' or packs = '${req.pack}')
    `;
        if(!requiredAttributes.includes('packs')) requiredAttributes.push('packs');
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

    return [q, qVar, requiredAttributes];
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
    }else if(req.requiredAttributesOnly){
        if(!_res[2].includes('beatmapset_id')) _res[2].push('beatmapset_id');
        if(!_res[2].includes('beatmap_id')) _res[2].push('beatmap_id');
        if(!_res[2].includes('artist')) _res[2].push('artist');
        if(!_res[2].includes('title')) _res[2].push('title');
        if(!_res[2].includes('version')) _res[2].push('version');
        if(!_res[2].includes('approved')) _res[2].push('approved');
        querySelector = _res[2].join(',');
    }else if(req.customAttributeSet){
        querySelector = req.customAttributeSet.join(',');
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
                const result = await InspectorBeatmap.count();
                if (result > 0) reachable = true;
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
                await Databases.osuAlt.authenticate();
                reachable = true;
            } catch (err) {
                reachable = false;
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

module.exports.getCompletionData = getCompletionData;
function getCompletionData(scores, beatmaps) {
    // cs
    const completion = {};
    let spread = ["0-1", "1-2", "2-3", "3-4", "4-5", "5-6", "6-7", "7-8", "8-9", "9-10"];
    completion.cs = [];
    for (const range of spread) {
        let perc = 100;
        let min = parseInt(range.split("-")[0]);
        let max = parseInt(range.split("-")[1]);
        let filtered_scores = scores.filter(score => score.beatmap.cs >= min && score.beatmap.cs < max);
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.cs >= min && beatmap.cs < max);
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.cs.push({
            range, min, max, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    completion.ar = [];
    for (const range of spread) {
        let perc = 100;
        let min = parseInt(range.split("-")[0]);
        let max = parseInt(range.split("-")[1]);
        let filtered_scores = scores.filter(score => score.beatmap.ar >= min && score.beatmap.ar < max);
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.ar >= min && beatmap.ar < max);
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.ar.push({
            range, min, max, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    completion.od = [];
    for (const range of spread) {
        let perc = 100;
        let min = parseInt(range.split("-")[0]);
        let max = parseInt(range.split("-")[1]);
        let filtered_scores = scores.filter(score => score.beatmap.od >= min && score.beatmap.od < max);
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.od >= min && beatmap.od < max);
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.od.push({
            range, min, max, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    completion.hp = [];
    for (const range of spread) {
        let perc = 100;
        let min = parseInt(range.split("-")[0]);
        let max = parseInt(range.split("-")[1]);
        let filtered_scores = scores.filter(score => score.beatmap.hp >= min && score.beatmap.hp < max);
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.hp >= min && beatmap.hp < max);
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.hp.push({
            range, min, max, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    spread = range(new Date().getFullYear() - 2007 + 1, 2007);
    completion.years = [];
    for (const year of spread) {
        let perc = 100;
        let filtered_scores = scores.filter(score => score.beatmap.approved_date.getFullYear() === year);
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.approved_date.getFullYear() === year);
        //console.log(new Date(scores[0].approved_date).getFullYear());
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.years.push({
            range: year, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    spread = ["0-1", "1-2", "2-3", "3-4", "4-5", "5-6", "6-7", "7-8", "8-9", "9-10", "10-20"];
    completion.stars = [];
    for (const range of spread) {
        let perc = 100;
        let min = parseInt(range.split('-')[0]);
        let max = parseInt(range.split('-')[1]);
        let filtered_scores = scores.filter(score => score.beatmap.stars >= min && score.beatmap.stars < max);
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.star_rating >= min && beatmap.star_rating < max);
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.stars.push({
            range: (max < 20 ? `${range}*` : (range.split('-')[0] + '*+')), min, max, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    spread = ["0-60", "60-120", "120-180", "180-240", "240-300", "300-360", "360-420", "420-480", "480-540", "540-600", "600-99999"];
    completion.length = [];
    for (const range of spread) {
        let perc = 100;
        let min = parseInt(range.split('-')[0]);
        let max = parseInt(range.split('-')[1]);
        let filtered_scores = scores.filter(score => score.beatmap.length >= min && score.beatmap.length < max);
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.total_length >= min && beatmap.total_length < max);
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.length.push({
            range: (max < 99999 ? range : (range.split('-')[0] + '+')), min, max, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    return completion;
}

const SESSION_DAYS = 3;
module.exports.VerifyToken = VerifyToken;
async function VerifyToken(session_token, user_id) {
    const result = await InspectorToken.findOne({
        where: {
            token: session_token,
            osu_id: user_id,
            date_created: {
                [Op.gt]: Sequelize.literal(`SUBDATE(CURRENT_TIMESTAMP, ${SESSION_DAYS})`)
            }
        }
    });
    return result === null ? false : true;
}