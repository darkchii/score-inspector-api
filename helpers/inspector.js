const { Client } = require("pg");
const { GetDailyUser, GetOsuUser, GetOsuUsers, OSU_CLIENT_ID, OSU_CLIENT_SECRET } = require("./osu");
const mysql = require('mysql-await');
const { default: axios } = require("axios");
const { range, renameKey } = require("./misc");
const { InspectorBeatmap, Databases, AltBeatmap, InspectorUser, InspectorRole, InspectorOsuUser, InspectorUserAccessToken, InspectorUserFriend, InspectorModdedStars } = require("./db");
const { Op, Sequelize } = require("sequelize");
const { GetAltUsers } = require("./osualt");
require('dotenv').config();

const connConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
};

module.exports.GetInspectorUser = GetInspectorUser;
async function GetInspectorUser(id) {
    try {
        const inspector_user = await InspectorUser.findOne(
            {
                where: { osu_id: id },
                include: [
                    {
                        model: InspectorRole,
                        attributes: ['id', 'title', 'description', 'color', 'icon', 'is_visible', 'is_admin', 'is_listed'],
                        through: { attributes: [] },
                        as: 'roles'
                    }
                ]
            });
        return inspector_user;

    } catch (e) {
        console.error(e);
        return null;
    }
}

module.exports.buildQuery = buildQuery;
function buildQuery(req) {
    const mode = req.mode !== undefined ? req.mode : 0;
    let q = `WHERE mode=? AND approved IN (1,2${(req.include_qualified !== undefined && req.include_qualified === 'true') ? ',3' : ''}${(req.include_loved !== undefined && req.include_loved === 'true') ? ',4' : ''})`;
    const qVar = [mode];
    let requiredAttributes = [];

    if (req.stars_min) {
        q += ' AND star_rating>=?';
        qVar.push(req.stars_min);

        if (!requiredAttributes.includes('star_rating')) requiredAttributes.push('star_rating');
    }
    if (req.stars_max) {
        q += ' AND star_rating<?';
        qVar.push(req.stars_max);
        if (!requiredAttributes.includes('star_rating')) requiredAttributes.push('star_rating');
    }
    if (req.ar_min) {
        q += ' AND ar>=?';
        qVar.push(req.ar_min);
        if (!requiredAttributes.includes('ar')) requiredAttributes.push('ar');
    }
    if (req.ar_max) {
        q += ' AND ar<?';
        qVar.push(req.ar_max);
        if (!requiredAttributes.includes('ar')) requiredAttributes.push('ar');
    }
    if (req.od_min) {
        q += ' AND od>=?';
        qVar.push(req.od_min);
        if (!requiredAttributes.includes('od')) requiredAttributes.push('od');
    }
    if (req.od_max) {
        q += ' AND od<?';
        qVar.push(req.od_max);
        if (!requiredAttributes.includes('od')) requiredAttributes.push('od');
    }
    if (req.cs_min) {
        q += ' AND cs>=?';
        qVar.push(req.cs_min);
        if (!requiredAttributes.includes('cs')) requiredAttributes.push('cs');
    }
    if (req.cs_max) {
        q += ' AND cs<?';
        qVar.push(req.cs_max);
        if (!requiredAttributes.includes('cs')) requiredAttributes.push('cs');
    }
    if (req.hp_min) {
        q += ' AND hp>=?';
        qVar.push(req.hp_min);
        if (!requiredAttributes.includes('hp')) requiredAttributes.push('hp');
    }
    if (req.hp_max) {
        q += ' AND hp<?';
        qVar.push(req.hp_max);
        if (!requiredAttributes.includes('hp')) requiredAttributes.push('hp');
    }
    if (req.length_min) {
        q += ' AND total_length>=?';
        qVar.push(req.length_min);
        if (!requiredAttributes.includes('total_length')) requiredAttributes.push('total_length');
    }
    if (req.length_max) {
        q += ' AND total_length<?';
        qVar.push(req.length_max);
        if (!requiredAttributes.includes('total_length')) requiredAttributes.push('total_length');
    }
    if (req.pack) {
        q += ` AND 
      (packs LIKE '${req.pack},%' or packs LIKE '%,${req.pack},%' or packs LIKE '%,${req.pack}' or packs = '${req.pack}')
    `;
        if (!requiredAttributes.includes('packs')) requiredAttributes.push('packs');
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
    } else if (req.requiredAttributesOnly) {
        if (!_res[2].includes('beatmapset_id')) _res[2].push('beatmapset_id');
        if (!_res[2].includes('beatmap_id')) _res[2].push('beatmap_id');
        if (!_res[2].includes('artist')) _res[2].push('artist');
        if (!_res[2].includes('title')) _res[2].push('title');
        if (!_res[2].includes('version')) _res[2].push('version');
        if (!_res[2].includes('approved')) _res[2].push('approved');
        querySelector = _res[2].join(',');
    } else if (req.customAttributeSet) {
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
                const data = await axios.get('https://score.respektive.pw/u/10153735', {
                    timeout: 1000,
                    headers: { "Accept-Encoding": "gzip,deflate,compress" }
                });
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
                const test_user = await GetOsuUser('peppy', 'osu', 'username', 1000);
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
        let filtered_scores = scores.filter(score => new Date(score.beatmap.approved_date).getFullYear() === year);
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
async function VerifyToken(session_token, user_id, refresh = false) {
    const result = await InspectorUserAccessToken.findOne({
        where: {
            access_token: session_token,
            osu_id: user_id,
        }
    });

    //check if created_at + expires_in is greater than current time
    let valid = result !== null && result !== undefined;
    if (valid) {
        console.log(`[TOKEN DEBUG] Found token for ${user_id}`);
        const created_at = new Date(result.created_at);
        const expires_in = result.expires_in;
        const now = new Date();
        const diff = now - created_at;
        const diff_in_seconds = diff / 1000;
        valid = diff_in_seconds < expires_in;
    }

    if (!valid && refresh) {
        console.log(`[TOKEN DEBUG] Token for ${user_id} is expired`);
        //try to refresh token
        const refresh_token = result.refresh_token;
        let refresh_result = null;
        try {
            refresh_result = await axios.post('https://osu.ppy.sh/oauth/token', {
                client_id: OSU_CLIENT_ID,
                client_secret: OSU_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: refresh_token,
                scope: 'identify public friends.read',
            });
        } catch (err) {
            throw new Error('Unable to refresh token, please relogin');
        }
        if (refresh_result?.data?.access_token !== null) {
            //update token
            console.log(`[TOKEN DEBUG] Refreshed token for ${user_id}`);
            await InspectorUserAccessToken.update({
                access_token: refresh_result.data.access_token,
                refresh_token: refresh_result.data.refresh_token,
                expires_in: refresh_result.data.expires_in,
                created_at: new Date(),
            }, {
                where: {
                    access_token: session_token,
                    osu_id: user_id,
                }
            });
            valid = true;
        }
    }

    return valid;
}

module.exports.GetToken = GetToken;
async function GetToken(user_id) {
    const result = await InspectorUserAccessToken.findOne({
        where: {
            osu_id: user_id,
        }
    });

    return result;
}

module.exports.DefaultInspectorUser = DefaultInspectorUser;
function DefaultInspectorUser(inspector_user, username, osu_id) {
    let _inspector_user = inspector_user;
    if (inspector_user === null || inspector_user === undefined || inspector_user?.id === null) {
        console.log(`Creating new inspector user for ${username}`);
        _inspector_user = {
            known_username: username,
            osu_id: osu_id,
            roles: []
        }
    }
    return _inspector_user;
}

module.exports.InspectorRefreshFriends = InspectorRefreshFriends;
async function InspectorRefreshFriends(access_token, osu_id) {
    if (!osu_id || !access_token) {
        throw new Error('Missing parameters');
        return;
    }

    const isTokenValid = await VerifyToken(access_token, osu_id, true);

    if (!isTokenValid) {
        throw new Error('Invalid token');
        return;
    }

    const friends_response = await axios.get('https://osu.ppy.sh/api/v2/friends', {
        headers: {
            "Accept-Encoding": "gzip,deflate,compress",
            "Authorization": `Bearer ${access_token}`
        }
    });

    let friend_array = [];

    if (friends_response?.data?.length > 0) {
        //clear old friends
        await InspectorUserFriend.destroy({
            where: {
                primary_osu_id: osu_id
            }
        });

        for (const friend of friends_response.data) {
            friend_array.push({
                primary_osu_id: osu_id,
                friend_osu_id: friend.id,
                friend_username: friend.username,
            });
        }

        await InspectorUserFriend.bulkCreate(friend_array);
    }
}

module.exports.getFullUsers = async function (user_ids, skippedData = { daily: false, alt: false, score: false }) {
    //split ids in array of integers
    let ids = user_ids;

    if (typeof user_ids === 'string') {
        ids = user_ids.split(',').map(id => parseInt(id));
    }

    let data = [];

    //we create arrays of each type of user data, and then we merge them together
    let inspector_users = [];
    let osu_users = [];
    let daily_users = [];
    let alt_users = [];
    let score_ranks = [];

    await Promise.all([
        //inspector users
        InspectorUser.findAll({
            where: {
                osu_id: ids
            },
            include: [{
                model: InspectorRole,
                attributes: ['id', 'title', 'description', 'color', 'icon', 'is_visible', 'is_admin', 'is_listed'],
                through: { attributes: [] },
                as: 'roles'
            }]
        }).then(users => {
            inspector_users = users;
        }),
        //osu users
        ids.length === 1 ? GetOsuUser(ids[0], 'osu', 'id').then(user => {
            osu_users = [user];
        }) : GetOsuUsers(ids).then(users => {
            osu_users = users;
        }),
        //daily users
        skippedData.daily ? null : Promise.all(ids.map(id => GetDailyUser(id, 0, 'id'))).then(users => {
            daily_users = users;
        }),
        //alt users
        skippedData.alt ? null : GetAltUsers(ids, ids.length === 1).then(users => {
            alt_users = JSON.parse(JSON.stringify(users));
        }),
        //score ranks
        skippedData.score ? null : axios.get(`https://score.respektive.pw/u/${ids.join(',')}`, {
            headers: { "Accept-Encoding": "gzip,deflate,compress" }
        }).then(res => {
            score_ranks = res.data;
        })
    ]);

    //we merge the data together
    ids.forEach(id => {
        let user = {};

        let osu_user = osu_users.find(user => user.id == id);
        if (!osu_user) return;
        let score_rank = score_ranks.find(user => user.user_id == id);
        user.osu = { ...osu_user, score_rank };

        let inspector_user = inspector_users.find(user => user.osu_id == id);
        user.inspector_user = DefaultInspectorUser(inspector_user, osu_user.username, osu_user.id);

        if (!skippedData.daily) {
            try {
                let daily_user = daily_users.find(user => user.osu_id == id);
                user.daily = daily_user;
            } catch (err) {

            }
        }

        if (!skippedData.alt) {
            let alt_user = alt_users.find(user => user.user_id == id);
            user.alt = alt_user;
        }

        data.push(user);
    });

    return data;
}

module.exports.validateApiKey = async function (api_key) {
    //if api_key is empty or null or whatever, return false
    if (!api_key) return false;

    //we dont care who uses it, just if it exists
    const result = await InspectorUser.findOne({
        where: {
            api_key: api_key
        }
    });

    return result !== null;
}

module.exports.GetBeatmapsModdedSr = async function (beatmap_id_mod_map, version) {
    console.time(`[DEBUG] GetBeatmapsModdedSr for version ${version}`);
    let beatmap_ids = Object.keys(beatmap_id_mod_map);
    let _modded_stars = await InspectorModdedStars[version].findAll({
        where: {
            beatmap_id: {
                [Op.in]: beatmap_ids
            }
        },
        raw: true,
        nest: true
    });

    
    //split beatmap_id and data in seperate, so we keep the index
    let result_beatmap_ids = [];
    let result_data = [];
    
    _modded_stars.forEach(beatmap => {
        result_beatmap_ids.push(beatmap.beatmap_id);
        result_data.push(beatmap.data);
    });

    //generate a single json string with all the data (each data is a json string)
    //every 1000 result_data entries
    let data = [];
    const chunkSize = 1000;
    for (let i = 0; i < result_data.length; i += chunkSize) {
        const chunk = result_data.slice(i, i + chunkSize);
        const data_string = `[${chunk.join(',')}]`;
        const _data = JSON.parse(data_string);
        
        data = [...data, ..._data];
      }

    //we create a map of beatmap_id -> data
    let data_map = {};

    for (let i = 0; i < result_beatmap_ids.length; i++) {
        data_map[result_beatmap_ids[i]] = data[i];
    }

    //we create a map of beatmap_id -> modded_sr
    let modded_sr_map = {};

    for (const beatmap_id in beatmap_id_mod_map) {
        let mods = beatmap_id_mod_map[beatmap_id];
        let data = data_map[beatmap_id];

        let _base_stars = data?.find(stars => stars.mods === 0);
        let _stars = data?.find(stars => stars.mods === mods);

        if (_base_stars && _stars) {
            modded_sr_map[beatmap_id] = {
                ..._stars,
                base: _base_stars,
            };
        }
    }
    console.timeEnd(`[DEBUG] GetBeatmapsModdedSr for version ${version}`);

    return modded_sr_map;
}