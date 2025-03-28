const { AltUser, AltScore, Raw, InspectorCountryStat, InspectorOsuUser, InspectorBeatmapDifficultyAttrib, InspectorBeatmapDifficulty, Databases, AltBeatmap } = require('./db');
const { CorrectedSqlScoreModsCustom, CorrectModScore, CorrectMod } = require('./misc');

require('dotenv').config();
const axios = require('axios').default;

let stored_token = null;
let refetch_token = null;

const OSU_CLIENT_ID = process.env.NODE_ENV === 'production' ? process.env.OSU_CLIENT_ID : process.env.OSU_CLIENT_ID_DEV;
const OSU_CLIENT_SECRET = process.env.NODE_ENV === 'production' ? process.env.OSU_CLIENT_SECRET : process.env.OSU_CLIENT_SECRET_DEV;

module.exports.OSU_CLIENT_ID = OSU_CLIENT_ID;
module.exports.OSU_CLIENT_SECRET = OSU_CLIENT_SECRET;

module.exports.MODE_SLUGS = ['osu', 'taiko', 'fruits', 'mania'];

const MODS = {
    None: 0,
    NF: 1,
    EZ: 2,
    TD: 4,
    HD: 8,
    HR: 16,
    SD: 32,
    DT: 64,
    RX: 128,
    HT: 256,
    NC: 512, // Only set along with DoubleTime. i.e: NC only gives 576
    FL: 1024,
    AP: 2048,
    SO: 4096,
    PF: 16384, // Only set along with SuddenDeath. i.e: PF only gives 16416  
    FI: 1048576,
    RN: 2097152,
    CI: 4194304,
    TG: 8388608,
    SV2: 536870912,
    MR: 1073741824
}
module.exports.MODS = MODS;

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

module.exports.AuthorizedApiCall = AuthorizedApiCall;
async function AuthorizedApiCall(url, type = 'get', api_version = null, timeout = 10000, post_body = null) {
    if (stored_token === null || refetch_token === null || refetch_token < Date.now()) {
        try {
            stored_token = await Login(OSU_CLIENT_ID, OSU_CLIENT_SECRET);
        } catch (err) {
            throw new Error('Unable to get osu!apiv2 token: ' + err.message);
        }
        refetch_token = Date.now() + 3600000;
    }

    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${stored_token}`,
        "Accept-Encoding": "gzip,deflate,compress", //axios fix (https://github.com/axios/axios/issues/5346)
        'x-api-version': 20240130
    };
    if (api_version != null) {
        headers['x-api-version'] = api_version;
    }

    let res;

    switch (type) {
        case 'get':
            res = await axios.get(url, {
                headers,
                timeout: parseInt(timeout)
            });
            break;
        case 'post':
            res = await axios.post(url, {
                headers,
                timeout: parseInt(timeout),
                data: post_body
            });
            break;
    }

    return res;
}

module.exports.GetOsuUser = GetOsuUser;
async function GetOsuUser(username, mode = 'osu', key = 'username', timeout = 10000) {
    try {
        const res = await AuthorizedApiCall(`https://osu.ppy.sh/api/v2/users/${username}/${mode}?key=${key}`, 'get', null, timeout);
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

module.exports.GetUserBeatmapScores = GetUserBeatmapScores;
async function GetUserBeatmapScores(username, beatmap_id, mode = 'osu', timeout = 10000) {
    const res = await AuthorizedApiCall(`https://osu.ppy.sh/api/v2/beatmaps/${beatmap_id}/scores/users/${username}/all?ruleset=${mode}`, 'get', null, timeout);
    try {
        return res.data;
    } catch (err) {
        throw new Error('Unable to get user beatmaps: ' + err.message);
    }
}

module.exports.GetBeatmaps = GetBeatmaps;
async function GetBeatmaps(beatmap_ids, timeout = 10000) {
    const res = await AuthorizedApiCall(`https://osu.ppy.sh/api/v2/beatmaps?ids[]=${beatmap_ids.join('&ids[]=')}`, 'get', null, timeout);
    try {
        return res.data;
    } catch (err) {
        throw new Error('Unable to get beatmaps: ' + err.message);
    }
}

module.exports.GetBeatmap = GetBeatmap;
async function GetBeatmap(beatmap_id, ruleset = 'osu', timeout = 10000) {
    const res = await AuthorizedApiCall(`https://osu.ppy.sh/api/v2/beatmaps/${beatmap_id}`, 'get', null, timeout);
    try {
        return res.data;
    } catch (err) {
        throw new Error('Unable to get beatmap: ' + err.message);
    }
}

module.exports.GetBeatmapScores = GetBeatmapScores;
async function GetBeatmapScores(beatmap_id, mode = 'osu', mods = null, timeout = 10000) {
    const res = await AuthorizedApiCall(`https://osu.ppy.sh/api/v2/beatmaps/${beatmap_id}/scores?mode=${mode}${mods ? `&mods=${mods}` : ''}`, 'get', null, timeout);
    try {
        return res.data;
    } catch (err) {
        throw new Error('Unable to get user beatmaps: ' + err.message);
    }
}

module.exports.GetOsuUsers = GetOsuUsers;
async function GetOsuUsers(id_array, timeout = 5000) {
    let users = [];
    let split_array = [];

    let cloned_ids = JSON.parse(JSON.stringify(id_array));
    //split array into chunks of 50
    while (cloned_ids.length > 0) {
        split_array.push(cloned_ids.splice(0, 50));
    }

    //get data from osu api
    for (let i = 0; i < split_array.length; i++) {
        try {
            const url = `https://osu.ppy.sh/api/v2/users?ids[]=${split_array[i].join('&ids[]=')}`;
            const res = await AuthorizedApiCall(url, 'get', null, timeout);
            let _users = JSON.parse(JSON.stringify(res.data))?.users;
            users = [...users, ..._users];
        } catch (err) {
        }
    }

    //update cover_url in inspector db
    if (users?.length > 0) {
        //bulk update
        try {
            for await (const user of users) {
                const cover_url = user?.cover?.custom_url ?? user?.cover?.url ?? null;
                if (cover_url) {
                    InspectorOsuUser.update({ cover_url: cover_url }, { where: { user_id: user.id } });
                }
            }
        } catch (err) {
        }
    }

    return users;
}

module.exports.GetCountryLeaderboard = GetCountryLeaderboard;
async function GetCountryLeaderboard() {
    try {
        const data = await InspectorCountryStat.findAll();

        //merge by country code
        let merged = [];
        data.forEach((row) => {
            let country = merged.find(c => c.country_code == row.country_code);
            if (country) {
                country[row.stat] = row.value;
            } else {
                merged.push({
                    country_code: row.country_code,
                    [row.stat]: row.value
                });
            }
        });

        let regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
        //add country name to each row
        merged.forEach((row) => {
            row.country = {
                code: row.country_code,
                name: regionNames.of(row.country_code)
            }

            row.ss_total_count = row.ssh_count + row.ss_count;
            row.s_total_count = row.sh_count + row.s_count;
            row.code = row.country_code;
        });

        return merged;
    } catch (err) {
        return null;
    }

    // let countries = [];
    // //5 pages to get
    // for (let i = 1; i <= 5; i++) {
    //     let pageString = `cursor[page]=${i}`
    //     try {
    //         const url = `https://osu.ppy.sh/api/v2/rankings/osu/country?${pageString}`;
    //         const res = await AuthorizedApiCall(url, 'get', null, timeout);
    //         countries = [...countries, ...res.data.ranking]
    //     } catch (err) {
    //         throw new Error('Unable to get data: ' + err.message);
    //     }
    // }

    // //get data from AltUser
    // if (countries !== null) {
    //     try {
    //         const rows = await AltUser.findAll({
    //             attributes: [
    //                 'country_code',
    //                 'country_name',
    //                 [Sequelize.fn('COUNT', Sequelize.col('country_code')), 'alt_players'],
    //                 [Sequelize.fn('SUM', Sequelize.col('total_score')), 'total_score'],
    //                 [Sequelize.fn('SUM', Sequelize.col('playcount')), 'playcount'],
    //                 [Sequelize.fn('SUM', Sequelize.col('playtime')), 'playtime'],
    //                 [Sequelize.fn('SUM', Sequelize.col('total_hits')), 'total_hits'],
    //                 [Sequelize.fn('SUM', Sequelize.col('replays_watched')), 'replays_watched'],
    //             ],
    //             group: ['country_code', 'country_name']
    //         });
    //         let _data = rows;
    //         countries.forEach((country) => {
    //             let row = _data.find(row => row.country_code == country.country.code);
    //             //convert everything to number
    //             if (row) {
    //                 country.alt_players = Number(row.dataValues.alt_players);
    //                 country.total_score = Number(row.dataValues.total_score) ?? 0;
    //                 country.playcount = Number(row.dataValues.playcount) ?? 0;
    //                 country.playtime = Number(row.dataValues.playtime) ?? 0;
    //                 country.total_hits = Number(row.dataValues.total_hits) ?? 0;
    //                 country.replays_watched = Number(row.dataValues.replays_watched) ?? 0;
    //                 country.perc_on_alt = (country.alt_players / country.active_users) * 100;
    //             }
    //         });
    //     } catch (err) {
    //         throw new Error('Unable to get data: ' + err.message);
    //     }
    // }

    // //get data from AltScore
    // if (countries !== null) {
    //     try {
    //         //raw query
    //         const _data = await Raw(`
    //         WITH MaxScores AS (
    //             SELECT
    //                 country_code,
    //                 beatmap_id,
    //                 MAX(score) AS max_score
    //             FROM
    //                 scores
    //             INNER JOIN users2 ON scores.user_id = users2.user_id
    //             GROUP BY
    //                 users2.country_code,
    //                 beatmap_id
    //         )

    //         SELECT 
    //             count(*) as alt_scores, 
    //             sum(case when scores.rank LIKE 'XH' then 1 else 0 end) as ssh_count,
    //             sum(case when scores.rank LIKE 'X' then 1 else 0 end) as ss_count,
    //             sum(case when scores.rank LIKE 'SH' then 1 else 0 end) as sh_count,
    //             sum(case when scores.rank LIKE 'S' then 1 else 0 end) as s_count,
    //             sum(case when scores.rank LIKE 'A' then 1 else 0 end) as a_count,
    //             sum(case when scores.rank LIKE 'B' then 1 else 0 end) as b_count,
    //             sum(case when scores.rank LIKE 'C' then 1 else 0 end) as c_count,
    //             sum(case when scores.rank LIKE 'D' then 1 else 0 end) as d_count,
    //             avg(scores.accuracy) as avg_acc,
    //             avg(scores.pp) as avg_pp,
    //             users2.country_code,
    //             COALESCE(max_scores.max_score, 0) AS national_score
    //         FROM scores
    //         INNER JOIN users2 ON scores.user_id = users2.user_id
    //         LEFT JOIN MaxScores max_scores ON users2.country_code = max_scores.country_code AND scores.beatmap_id = max_scores.beatmap_id
    //         GROUP BY users2.country_code;

    //         `, 'osuAlt');
    //         console.log(_data);
    //         countries.forEach((country) => {
    //             let row = _data[0].find(row => row.country_code == country.country.code);
    //             //convert everything to number
    //             if (row) {
    //                 country.alt_scores = Number(row.alt_scores);
    //                 country.ss_total_count = Number(row.ssh_count) + Number(row.ss_count);
    //                 country.s_total_count = Number(row.sh_count) + Number(row.s_count);
    //                 country.ssh_count = Number(row.ssh_count) ?? 0;
    //                 country.ss_count = Number(row.ss_count) ?? 0;
    //                 country.sh_count = Number(row.sh_count) ?? 0;
    //                 country.s_count = Number(row.s_count) ?? 0;
    //                 country.a_count = Number(row.a_count) ?? 0;
    //                 country.b_count = Number(row.b_count) ?? 0;
    //                 country.c_count = Number(row.c_count) ?? 0;
    //                 country.d_count = Number(row.d_count) ?? 0;
    //                 country.avg_acc = Number(row.avg_acc) ?? 0;
    //                 country.avg_pp = Number(row.avg_pp) ?? 0;
    //                 country.national_score = Number(row.national_score) ?? 0;
    //             }
    //         });
    //     }
    //     catch (err) {
    //         throw new Error('Unable to get data: ' + err.message);
    //     }
    // }
    // return countries;
}

module.exports.GetOsuUserScores = GetOsuUserScores;
async function GetOsuUserScores(username, type = 'best', mode = 'osu', limit = 100, offset = 0, timeout = 10000) {
    try {
        const res = await AuthorizedApiCall(`https://osu.ppy.sh/api/v2/users/${username}/scores/${type}?mode=${mode}&limit=${limit}&offset=${offset}`, 'get', null, timeout);
        return res.data;
    } catch (err) {
        throw new Error('Unable to get user scores: ' + err.message);
    }
}


module.exports.GetBeatmapAttributes = GetBeatmapAttributes;
async function GetBeatmapAttributes(beatmap_id, mods, ruleset = 0, timeout = 10000) {
    let api_url = 'http://192.168.178.59:5001';
    try {
        const res = await axios.post(`${api_url}/attributes`, {
            beatmap_id: beatmap_id,
            mods: mods,
            ruleset_id: ruleset,
        })
        return res.data;
    } catch (err) {
        throw new Error('Unable to get beatmap attributes: ' + err.message);
    }
}

module.exports.ConvertOsuScoreResultToInspectorScore = ConvertOsuScoreResultToInspectorScore;
async function ConvertOsuScoreResultToInspectorScore(score, user) {
    const attributes = await GetBeatmapAttributes(score.beatmap.id, score.mods);

    let inspector_score = {
        user_id: score.user.id,
        beatmap_id: score.beatmap.id,
        // score: score.legacy_total_score ?? score.classic_total_score ?? score.total_score,
        count300: score.statistics.great ?? 0,
        count100: score.statistics.meh ?? 0,
        count50: score.statistics.ok ?? 0,
        countmiss: score.statistics.miss ?? 0,
        combo: score.max_combo,
        perfect: score.legacy_perfect ?? score.is_perfect_combo,
        enabled_mods: null, //legacy, we shouldn't use this
        date_played: score.ended_at,
        rank: score.rank,
        pp: score.pp,
        replay_available: score.replay ? 1 : 0,
        accuracy: score.accuracy * 100,
        mods: score.mods,
    };


    inspector_score.score = score.legacy_total_score;
    if (!inspector_score.score || inspector_score.score == 0) {
        inspector_score.score = score.classic_total_score;
    }

    if (!inspector_score.score || inspector_score.score == 0) {
        inspector_score.score = score.total_score;
    }

    inspector_score.beatmap = {
        beatmap_id: score.beatmap.id,
        approved: score.beatmap.ranked,
        submit_date: null,
        approved_date: null,
        last_update: score.beatmap.last_updated,
        artist: score.beatmapset.artist,
        set_id: score.beatmapset.id,
        bpm: score.beatmap.bpm,
        creator: score.beatmapset.creator,
        creator_id: null, //for some reason, api doesn't provide this
        stars: score.beatmap.difficulty_rating,
        diff_aim: null,
        diff_speed: null,
        cs: score.beatmap.cs,
        od: score.beatmap.accuracy,
        ar: score.beatmap.ar,
        hp: score.beatmap.drain,
        drain: score.beatmap.total_length,
        source: score.beatmapset.source,
        genre: null, //for some reason, api doesn't provide this
        language: null, //for some reason, api doesn't provide this
        title: score.beatmapset.title,
        length: score.beatmap.hit_length,
        diffname: score.beatmap.version,
        file_md5: score.beatmap.checksum,
        mode: score.mode,
        tags: null, //for some reason, api doesn't provide this
        favorites: null,
        rating: null,
        playcount: score.beatmap.play_count,
        passcount: score.beatmap.pass_count,
        circles: score.beatmap.count_circles,
        sliders: score.beatmap.count_sliders,
        spinners: score.beatmap.count_spinners,
        maxcombo: attributes.max_combo, //TODO, uses osu apiv2 attributes endpoint
        storyboard: null, //for some reason, api doesn't provide this
        video: null, //for some reason, api doesn't provide this
        download_unavailable: null, //for some reason, api doesn't provide this
        audio_unavailable: null, //for some reason, api doesn't provide this
        difficulty_data: {
            star_rating: attributes.star_rating,
            aim_difficulty: attributes.aim_difficulty,
            speed_difficulty: attributes.speed_difficulty,
            speed_note_count: attributes.speed_note_count,
            flashlight_difficulty: attributes.flashlight_difficulty ?? null,
            aim_difficult_strain_count: attributes.aim_difficult_strain_count,
            speed_difficult_strain_count: attributes.speed_difficult_strain_count,
            overall_difficulty: attributes.overall_difficulty,
            drain_rate: attributes.hp,
            slider_factor: attributes.slider_factor,
        }
    }

    inspector_score.user = user;

    return inspector_score;
}

const DIFFICULTY_ATTRIBUTES = {
    1: 'aim',
    3: 'speed',
    5: 'od',
    7: 'ar',
    9: 'max_combo',
    11: 'strain',
    13: 'hit_window_300',
    15: 'score_multiplier',
    17: 'flashlight_rating',
    19: 'slider_factor',
    21: 'speed_note_count',
    23: 'speed_difficult_strain_count',
    25: 'aim_difficult_strain_count',
    27: 'hit_window_100',
    29: 'mono_stamina_factor'
}

const BATCH_DIFF_DATA_FETCH = 1000;
module.exports.ApplyDifficultyData = ApplyDifficultyData;
async function ApplyDifficultyData(scores, force_all_mods = false, custom_mods = null) {

    scores.forEach(score => {
        if (score.modern_mods) {
            score.mods = score.modern_mods;
            delete score.modern_mods;
        }
    });

    scores.forEach(score => {
        if (!score.mods?.star_rating) {
            let modded_sr = score.modded_sr;

            if (!modded_sr) {
                //fallback of the fallback
                //if moddedsr also doesnt exist, we just go we the raw beatmap data
                //nothing else we can do
                modded_sr = {
                    star_rating: score.beatmap.stars,
                    aim_diff: 0, //doesnt exist
                    speed_diff: 0, //doesnt exist
                    fl_diff: 0, //doesnt exist
                    modded_od: score.beatmap.od,
                    modded_ar: score.beatmap.ar,
                    modded_hp: score.beatmap.hp,
                    modded_cs: score.beatmap.cs,
                    slider_factor: 1,
                    speed_note_count: 0,
                    unranked: true
                }
            }

            if (!score.beatmap.difficulty_data) {
                score.beatmap.difficulty_data = {};
            }

            score.beatmap.difficulty_data.star_rating = modded_sr.star_rating;
            score.beatmap.difficulty_data.aim_difficulty = modded_sr.aim_diff;
            score.beatmap.difficulty_data.speed_difficulty = modded_sr.speed_diff;
            score.beatmap.difficulty_data.flashlight_difficulty = modded_sr.fl_diff;
            score.beatmap.difficulty_data.overall_difficulty = modded_sr.modded_od;
            score.beatmap.difficulty_data.approach_rate = modded_sr.modded_ar;
            score.beatmap.difficulty_data.drain_rate = modded_sr.modded_hp;
            score.beatmap.difficulty_data.circle_size = modded_sr.modded_cs;
            score.beatmap.difficulty_data.slider_factor = modded_sr.slider_factor;
            score.beatmap.difficulty_data.speed_note_count = modded_sr.speed_note_count;

            score.beatmap.difficulty_data.aim_difficult_slider_count = 0;
            score.beatmap.difficulty_data.aim_difficult_strain_count = 0;
            score.beatmap.difficulty_data.speed_difficult_strain_count = 0;

            score.beatmap.difficulty_data.is_legacy = true;
            score.beatmap.difficulty_data.unranked = modded_sr.unranked;

            delete score.modded_sr;
            delete score.mods;
        } else {
            score.beatmap.difficulty_data = score.mods;
            score.mods = score.mods.mods;
            score.statistics = score.beatmap.difficulty_data.statistics ?? null;
            score.maximum_statistics = score.beatmap.difficulty_data.maximum_statistics ?? null;

            delete score.beatmap.difficulty_data.statistics;
            delete score.beatmap.difficulty_data.maximum_statistics
        }
    });

    return scores;
}