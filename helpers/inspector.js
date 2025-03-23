const { Client } = require("pg");
const { GetOsuUser, GetOsuUsers, OSU_CLIENT_ID, OSU_CLIENT_SECRET } = require("./osu");
const { default: axios } = require("axios");
const { range } = require("./misc");
const { Databases, InspectorUser, InspectorRole, InspectorUserAccessToken, Raw } = require("./db");
const { GetAltUsers } = require("./osualt");
const moment = require("moment");
const { DefaultInspectorUser } = require("./user");
const { default: Sequelize } = require("@sequelize/core");
const { GetUsersTeams, GetUserTeam } = require("./teams");
require('dotenv').config();

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

        const team = await GetUserTeam(id);
        return DefaultInspectorUser(inspector_user, null, id, team);
        // return inspector_user;
    } catch (e) {
        return null;
    }
}

module.exports.GetInspectorUsers = GetInspectorUsers;
async function GetInspectorUsers(ids) {
    try {
        const inspector_users = await InspectorUser.findAll(
            {
                where: { osu_id: ids },
                include: [
                    {
                        model: InspectorRole,
                        attributes: ['id', 'title', 'description', 'color', 'icon', 'is_visible', 'is_admin', 'is_listed'],
                        through: { attributes: [] },
                        as: 'roles'
                    }
                ]
            });

        const teams = await GetUsersTeams(ids);

        let users = [];

        inspector_users.forEach(inspector_user => {
            const team = teams.find(team => team.user_id == inspector_user.osu_id)?.team || null;
            users.push(DefaultInspectorUser(inspector_user, null, inspector_user.osu_id, team));
        });

        return users;
    } catch (e) {
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
        q += ' AND stars>=?';
        qVar.push(req.stars_min);

        if (!requiredAttributes.includes('stars')) requiredAttributes.push('stars');
    }
    if (req.stars_max) {
        q += ' AND stars<?';
        qVar.push(req.stars_max);
        if (!requiredAttributes.includes('stars')) requiredAttributes.push('stars');
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
        q += ' AND length>=?';
        qVar.push(req.length_min);
        if (!requiredAttributes.includes('length')) requiredAttributes.push('length');
    }
    if (req.length_max) {
        q += ' AND length<?';
        qVar.push(req.length_max);
        if (!requiredAttributes.includes('length')) requiredAttributes.push('length');
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
    // const connection = mysql.createConnection(connConfig);
    const _res = buildQuery(req);
    const q = _res[0];
    const qVar = _res[1];

    let querySelector = `*`;

    if (req.compact) {
        querySelector = 'beatmapset_id, beatmap_id, artist, title, diffname, approved';
    } else if (req.requiredAttributesOnly) {
        if (!_res[2].includes('beatmapset_id')) _res[2].push('beatmapset_id');
        if (!_res[2].includes('beatmap_id')) _res[2].push('beatmap_id');
        if (!_res[2].includes('artist')) _res[2].push('artist');
        if (!_res[2].includes('title')) _res[2].push('title');
        if (!_res[2].includes('diffname')) _res[2].push('diffname');
        if (!_res[2].includes('approved')) _res[2].push('approved');
        if (!_res[2].includes('maxcombo')) _res[2].push('maxcombo');
        querySelector = _res[2].join(',');
    } else if (req.customAttributeSet) {
        querySelector = req.customAttributeSet.join(',');
    }

    const query = `SELECT ${querySelector} FROM beatmaps ${q}`;
    const result = await Databases.osuAlt.query(query, {
        replacements: qVar,
        type: Sequelize.QueryTypes.SELECT
    });
    return result;
}

module.exports.IsReachable = IsReachable;
async function IsReachable(endpoint) {
    let reachable = false;

    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            resolve(false);
        }, 2000);
    });

    switch (endpoint) {
        case 'osuv2':
            try {
                const test_user = await Promise.race([GetOsuUser('peppy', 'osu', 'username', 1000), timeoutPromise]);
                if (test_user?.id == 2) reachable = true;
            } catch (e) { }
            break;
        case 'osualt':
            try {
                await Promise.race([Databases.osuAlt.authenticate(), timeoutPromise]);
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
        req.query.include_loved = 'true';
    }

    const _res = buildQuery(req.query);
    const q = _res[0];
    const qVar = _res[1];

    // const result = await connection.awaitQuery(`SELECT COUNT(*) as amount FROM beatmap ${q}`, qVar);
    const result = await Raw(`SELECT COUNT(*) as amount FROM beatmaps ${q}`, 'osuAlt', {
        replacements: qVar,
        type: Sequelize.QueryTypes.SELECT
    });

    return result?.[0]?.amount;
}

module.exports.getCompletionData = getCompletionData;
function getCompletionData(scores, beatmaps) {
    // cs
    const completion = {};
    let spread = ["0-1", "1-2", "2-3", "3-4", "4-5", "5-6", "6-7", "7-8", "8-9", "9-10", "10-11"];
    completion.cs = [];
    for (const range of spread) {
        const is_last = range === spread[spread.length - 1];
        let perc = 100;
        let min = parseInt(range.split("-")[0]);
        let max = parseInt(range.split("-")[1]);
        let range_output = `${min}-${max}`;
        if (is_last) range_output = `${min}+`;
        let filtered_scores = scores.filter(score => score.beatmap.cs >= min && (is_last ? true : score.beatmap.cs < max));
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.cs >= min && (is_last ? true : beatmap.cs < max));
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.cs.push({
            range: range_output, min, max, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    completion.ar = [];
    for (const range of spread) {
        const is_last = range === spread[spread.length - 1];
        let perc = 100;
        let min = parseInt(range.split("-")[0]);
        let max = parseInt(range.split("-")[1]);
        let range_output = `${min}-${max}`;
        if (is_last) range_output = `${min}+`;
        let filtered_scores = scores.filter(score => score.beatmap.ar >= min && (is_last ? true : score.beatmap.ar < max));
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.ar >= min && (is_last ? true : beatmap.ar < max));
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.ar.push({
            range: range_output, min, max, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    completion.od = [];
    for (const range of spread) {
        const is_last = range === spread[spread.length - 1];
        let perc = 100;
        let min = parseInt(range.split("-")[0]);
        let max = parseInt(range.split("-")[1]);
        let range_output = `${min}-${max}`;
        if (is_last) range_output = `${min}+`;
        let filtered_scores = scores.filter(score => score.beatmap.od >= min && (is_last ? true : score.beatmap.od < max));
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.od >= min && (is_last ? true : beatmap.od < max));
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.od.push({
            range: range_output, min, max, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    completion.hp = [];
    for (const range of spread) {
        const is_last = range === spread[spread.length - 1];
        let perc = 100;
        let min = parseInt(range.split("-")[0]);
        let max = parseInt(range.split("-")[1]);
        let range_output = `${min}-${max}`;
        if (is_last) range_output = `${min}+`;
        let filtered_scores = scores.filter(score => score.beatmap.hp >= min && (is_last ? true : score.beatmap.hp < max));
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.hp >= min && (is_last ? true : beatmap.hp < max));
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.hp.push({
            range: range_output, min, max, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    // spread = range(new Date().getFullYear() - 2007 + 1, 2007);
    // use moment utc
    spread = range(moment.utc().year() - 2007 + 1, 2007);
    completion.years = [];
    for (const year of spread) {
        const moment_year = moment.utc().year(year);
        let perc = 100;
        // use utc, use isSame
        //string format is YYYY-MM-DDTHH:mm:ss[Z]
        // let filtered_scores = scores.filter(score => moment(score.beatmap.approved_date).local().isSame(moment_year, 'year'));
        // let filtered_beatmaps = beatmaps.filter(beatmap => moment(beatmap.approved_date).local().isSame(moment_year, 'year'));
        let filtered_scores = scores.filter(score => moment(score.beatmap.approved_date).utc().isSame(moment_year, 'year'));
        let filtered_beatmaps = beatmaps.filter(beatmap => moment(beatmap.approved_date).utc().isSame(moment_year, 'year'));

        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.years.push({
            range: year, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    spread = ["0-1", "1-2", "2-3", "3-4", "4-5", "5-6", "6-7", "7-8", "8-9", "9-10", "10-20"];
    completion.stars = [];
    for (const range of spread) {
        const is_last = range === spread[spread.length - 1];
        let perc = 100;
        let min = parseInt(range.split('-')[0]);
        let max = parseInt(range.split('-')[1]);
        let filtered_scores = scores.filter(score => score.beatmap.stars >= min && (is_last ? true : score.beatmap.stars < max));
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.stars >= min && (is_last ? true : beatmap.stars < max));
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
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.length >= min && beatmap.length < max);
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.length.push({
            range: (max < 99999 ? range : (range.split('-')[0] + '+')), min, max, completion: perc, scores: filtered_scores.length, beatmaps: filtered_beatmaps.length
        });
    }

    spread = ["0-100", "100-200", "200-300", "300-400", "400-500", "500-600", "600-700", "700-800", "800-900", "900-1000", "1000-99999"];
    completion.max_combo = [];
    for (const range of spread) {
        let perc = 100;
        let min = parseInt(range.split('-')[0]);
        let max = parseInt(range.split('-')[1]);
        let filtered_scores = scores.filter(score => score.beatmap.maxcombo >= min && score.beatmap.maxcombo < max);
        let filtered_beatmaps = beatmaps.filter(beatmap => beatmap.maxcombo >= min && beatmap.maxcombo < max);
        perc = filtered_scores.length / filtered_beatmaps.length * 100;
        completion.max_combo.push({
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

    if (!result) {
        throw new Error('Invalid token');
        return false;
    }

    //check if user is banned
    const _user = await InspectorUser.findOne({
        where: {
            osu_id: user_id,
        }
    });

    if (_user?.is_banned) {
        throw new Error('User is banned');
        return false;
    }

    //check if created_at + expires_in is greater than current time
    let valid = result !== null && result !== undefined;
    if (valid) {
        // check if token is valid at osu api
        let check_result = null;
        try {
            check_result = await axios.get('https://osu.ppy.sh/api/v2/me/osu', {
                headers: {
                    "Accept-Encoding": "gzip,deflate,compress",
                    "Authorization": `Bearer ${session_token}`
                }
            });
        } catch (err) {
        }

        if (!check_result || check_result?.data?.id != user_id) {
            throw new Error('Invalid token');
        }

        const created_at = new Date(result.created_at);
        const expires_in = result.expires_in;
        const now = new Date();
        const diff = now - created_at;
        const diff_in_seconds = diff / 1000;
        valid = diff_in_seconds < expires_in;
    }

    if (!valid && refresh) {
        //try to refresh token
        const refresh_token = result.refresh_token;
        let refresh_result = null;
        try {
            refresh_result = await axios.post('https://osu.ppy.sh/oauth/token', {
                client_id: OSU_CLIENT_ID,
                client_secret: OSU_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: refresh_token,
                scope: `identify public`,
            });
        } catch (err) {
            throw new Error('Unable to refresh token, please relogin');
        }
        if (refresh_result?.data?.access_token !== null) {
            //update token
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

module.exports.getFullUsers = async function (user_ids, skippedData = { alt: false, score: false, osu: false, extras: false, teams: false }, allowFallback = false, forceLocalAlt = false) {
    //split ids in array of integers
    let ids = user_ids;

    if (typeof user_ids === 'string') {
        ids = user_ids.split(',').map(id => parseInt(id));
    }

    if (ids.length === 0) return [];

    let data = [];

    //we create arrays of each type of user data, and then we merge them together
    let inspector_users = [];
    let osu_users = [];
    let alt_users = [];
    let score_ranks = [];
    let teams = [];

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
        }).catch(err => {
        }),
        //osu users
        skippedData.osu ? null : ids.length === 1 ? GetOsuUser(ids[0], 'osu', 'id').then(user => {
            osu_users = [user];
        }).catch(err => { }) : GetOsuUsers(ids).then(users => {
            osu_users = users;
        }).catch(err => {
        }),
        //alt users
        skippedData.alt ? null : GetAltUsers(ids, ids.length === 1 && !skippedData.extras, forceLocalAlt).then(users => {
            alt_users = users;
        }).catch(err => {
        }),
        //teams
        skippedData.teams ? null : GetUsersTeams(ids).then(_teams => {
            teams = _teams;
        }).catch(err => {
            console.log(err);
        }),
        //score ranks
        skippedData.score || skippedData.osu ? null : axios.get(`https://score.respektive.pw/u/${ids.join(',')}`, {
            headers: { "Accept-Encoding": "gzip,deflate,compress" }
        }).then(res => {
            score_ranks = res.data;
        }).catch(err => {
        })
    ]);

    if (allowFallback && skippedData.osu && !skippedData.alt) {
        //find users with missing alt data and get osu data instead
        let missingAltIds = ids.filter(id => !alt_users.find(user => user.user_id == id));
        //unique
        missingAltIds = [...new Set(missingAltIds)];
        let missingAltUsers = await GetOsuUsers(missingAltIds);

        //merge the data
        osu_users = osu_users.concat(missingAltUsers);
    }

    //we merge the data together
    ids.forEach(id => {
        let user = {};

        let inspector_user = inspector_users.find(user => user.osu_id == id);

        let alt_user = alt_users.find(user => user.user_id == id);
        let osu_user = osu_users.find(user => user.id == id);
        let score_rank = score_ranks.find(user => user.user_id == id);
        let team = teams.find(team => team.user_id == id)?.team || null;

        let username = !osu_user ? alt_user?.username : osu_user?.username;
        if (!username && !allowFallback) return;
        if (!username && allowFallback) {
            username = inspector_user?.known_username;
        }

        // if (!skippedData.alt) { user.alt = alt_user; }
        // if (!skippedData.osu) { user.osu = { ...osu_user, score_rank }; }
        user.alt = alt_user || null;
        user.osu = osu_user ? { ...osu_user, score_rank } : null;
        // user.team = team;
        user.inspector_user = DefaultInspectorUser(inspector_user, username, parseInt(id), team);

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
