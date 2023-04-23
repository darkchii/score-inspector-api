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
    const res = await axios.get(`https://osudaily.net/api/user.php?k=${process.env.OSUDAILY_API}&u=${user_id}&m=${mode}&min=0`, { timeout });
    try {
        return res.data;
    } catch (err) {
        console.log(err);
        return null;
    }
}