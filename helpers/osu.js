const { Sequelize } = require('sequelize');
const { AltUser, AltScore, Raw } = require('./db');

require('dotenv').config();
const axios = require('axios').default;

let stored_token = null;
let refetch_token = null;

async function Login(client_id, client_secret) {
    const data = {
        client_id,
        client_secret,
        grant_type: 'client_credentials',
        scope: 'public',
    };

    try {
        const res = await axios.post('https://osu.ppy.sh/oauth/token', data, {
            headers: {
                "Accept-Encoding": "gzip,deflate,compress"
            }
        });
        return res.data.access_token;
    } catch (err) {
        throw new Error('Unable to get osu!apiv2 token: ' + err.message);
    }
}

async function AuthorizedApiCall(url, type = 'get', api_version = null, timeout = 10000) {
    if (stored_token === null || refetch_token === null || refetch_token < Date.now()) {
        try {
            stored_token = await Login(process.env.OSU_CLIENT_ID, process.env.OSU_CLIENT_SECRET);
        } catch (err) {
            throw new Error('Unable to get osu!apiv2 token: ' + err.message);
        }
        refetch_token = Date.now() + 3600000;
        console.log('Refreshed osu!apiv2 token');
    }

    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${stored_token}`,
        "Accept-Encoding": "gzip,deflate,compress" //axios fix (https://github.com/axios/axios/issues/5346)
        // 'x-api-version': 20220704
    };
    if (api_version != null) {
        headers['x-api-version'] = api_version;
    }

    let res;

    switch (type) {
        case 'get':
            res = await axios.get(url, {
                headers,
                timeout
            });
            break;
        case 'post':
            res = await axios.post(url, {
                headers
            });
            break;
    }

    return res;
}

module.exports.GetUser = GetUser;
async function GetUser(username, mode = 'osu', key = 'username', timeout = 10000) {
    const res = await AuthorizedApiCall(`https://osu.ppy.sh/api/v2/users/${username}/${mode}?key=${key}`, 'get', null, timeout);
    try {
        return res.data;
    } catch (err) {
        throw new Error('Unable to get user: ' + err.message);
    }
}

module.exports.GetUserBeatmaps = GetUserBeatmaps;
async function GetUserBeatmaps(username, type = 'ranked', limit = 100, offset = 0, timeout = 10000) {
    const res = await AuthorizedApiCall(`https://osu.ppy.sh/api/v2/users/${username}/beatmapsets/${type}?limit=${limit}&offset=${offset}`, 'get', null, timeout);
    try {
        return res.data;
    } catch (err) {
        throw new Error('Unable to get user beatmaps: ' + err.message);
    }
}

module.exports.GetUsers = GetUsers;
async function GetUsers(id_array, timeout = 5000) {
    const url = `https://osu.ppy.sh/api/v2/users?ids[]=${id_array.join('&ids[]=')}`;
    // console.log(url);
    const res = await AuthorizedApiCall(url, 'get', null, timeout);
    try {
        return res.data;
    } catch (err) {
        throw new Error('Unable to get users: ' + err.message);
    }
}

module.exports.GetDailyUser = GetDailyUser;
async function GetDailyUser(user_id, mode = 0, key = 'id', timeout = 1000) {
    try {
        const res = await axios.get(`https://osudaily.net/api/user.php?k=${process.env.OSUDAILY_API}&u=${user_id}&m=${mode}&min=0`, { timeout });
        return res.data;
    } catch (err) {
        console.log(err);
        return null;
    }
}

module.exports.GetCountryLeaderboard = GetCountryLeaderboard;
async function GetCountryLeaderboard(timeout = 1000) {
    let countries = [];
    //5 pages to get
    for (let i = 1; i <= 5; i++) {
        let pageString = `cursor[page]=${i}`
        try {
            const url = `https://osu.ppy.sh/api/v2/rankings/osu/country?${pageString}`;
            const res = await AuthorizedApiCall(url, 'get', null, timeout);
            countries = [...countries, ...res.data.ranking]
        } catch (err) {
            throw new Error('Unable to get data: ' + err.message);
        }
    }

    //get data from AltUser
    if (countries !== null) {
        try {
            const rows = await AltUser.findAll({
                attributes: [
                    'country_code',
                    'country_name',
                    [Sequelize.fn('COUNT', Sequelize.col('country_code')), 'alt_players'],
                    [Sequelize.fn('SUM', Sequelize.col('total_score')), 'total_score'],
                    [Sequelize.fn('SUM', Sequelize.col('playcount')), 'playcount'],
                    [Sequelize.fn('SUM', Sequelize.col('playtime')), 'playtime'],
                    [Sequelize.fn('SUM', Sequelize.col('total_hits')), 'total_hits'],
                    [Sequelize.fn('SUM', Sequelize.col('replays_watched')), 'replays_watched'],
                ],
                group: ['country_code', 'country_name']
            });
            let _data = rows;
            countries.forEach((country) => {
                let row = _data.find(row => row.country_code == country.country.code);
                //convert everything to number
                if (row) {
                    country.alt_players = Number(row.dataValues.alt_players);
                    country.total_score = Number(row.dataValues.total_score) ?? 0;
                    country.playcount = Number(row.dataValues.playcount) ?? 0;
                    country.playtime = Number(row.dataValues.playtime) ?? 0;
                    country.total_hits = Number(row.dataValues.total_hits) ?? 0;
                    country.replays_watched = Number(row.dataValues.replays_watched) ?? 0;
                    country.perc_on_alt = (country.alt_players / country.active_users) * 100;
                }
            });
        } catch (err) {
            throw new Error('Unable to get data: ' + err.message);
        }
    }

    //get data from AltScore
    if (countries !== null) {
        try {
            //raw query
            const _data = await Raw(`
                SELECT 
                    count(*) as alt_scores, 
                    sum(case when scores.rank LIKE 'XH' then 1 else 0 end) as ssh_count,
                    sum(case when scores.rank LIKE 'X' then 1 else 0 end) as ss_count,
                    sum(case when scores.rank LIKE 'SH' then 1 else 0 end) as sh_count,
                    sum(case when scores.rank LIKE 'S' then 1 else 0 end) as s_count,
                    sum(case when scores.rank LIKE 'A' then 1 else 0 end) as a_count,
                    sum(case when scores.rank LIKE 'B' then 1 else 0 end) as b_count,
                    sum(case when scores.rank LIKE 'C' then 1 else 0 end) as c_count,
                    sum(case when scores.rank LIKE 'D' then 1 else 0 end) as d_count,
                    avg(scores.accuracy) as avg_acc,
                    avg(scores.pp) as avg_pp,
                    country_code 
                FROM scores
                INNER JOIN users2 ON scores.user_id = users2.user_id
                GROUP BY country_code
            `, 'osuAlt');
            console.log(_data);
            countries.forEach((country) => {
                let row = _data[0].find(row => row.country_code == country.country.code);
                //convert everything to number
                if (row) {
                    country.alt_scores = Number(row.alt_scores);
                    country.ssh_count = Number(row.ssh_count) ?? 0;
                    country.ss_count = Number(row.ss_count) ?? 0;
                    country.sh_count = Number(row.sh_count) ?? 0;
                    country.s_count = Number(row.s_count) ?? 0;
                    country.a_count = Number(row.a_count) ?? 0;
                    country.b_count = Number(row.b_count) ?? 0;
                    country.c_count = Number(row.c_count) ?? 0;
                    country.d_count = Number(row.d_count) ?? 0;
                    country.avg_acc = Number(row.avg_acc) ?? 0;
                    country.avg_pp = Number(row.avg_pp) ?? 0;
                }
            });
        }
        catch (err) {
            throw new Error('Unable to get data: ' + err.message);
        }
    }
    return countries;
}