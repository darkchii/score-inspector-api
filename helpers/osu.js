const { Sequelize, where, sql } = require('sequelize');
const { AltUser, AltScore, Raw, InspectorCountryStat, InspectorOsuUser, InspectorBeatmapDifficultyAttrib, InspectorBeatmapDifficulty, Databases } = require('./db');
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
async function AuthorizedApiCall(url, type = 'get', api_version = null, timeout = 10000) {
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
                timeout: parseInt(timeout)
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

module.exports.GetBeatmaps = GetBeatmaps;
async function GetBeatmaps(beatmap_ids, timeout = 10000) {
    const res = await AuthorizedApiCall(`https://osu.ppy.sh/api/v2/beatmaps?ids[]=${beatmap_ids.join('&ids[]=')}`, 'get', null, timeout);
    try {
        return res.data;
    } catch (err) {
        throw new Error('Unable to get beatmaps: ' + err.message);
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
        if (!score.mods?.star_rating && score.beatmap.modded_sr) {
            if (score.beatmap.modded_sr) {
                let modded_sr = score.beatmap.modded_sr;

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
                score.beatmap.difficulty_data.slider_factory = modded_sr.slider_factory;
                score.beatmap.difficulty_data.speed_note_count = modded_sr.speed_note_count;

                score.beatmap.difficulty_data.aim_difficult_strain_count = 0;
                score.beatmap.difficulty_data.speed_difficult_strain_count = 0;

                score.beatmap.difficulty_data.is_legacy = true;

                delete score.beatmap.modded_sr;
                delete score.mods;
            }
        }else{
            score.beatmap.difficulty_data = score.mods;
            score.mods = score.mods.mods;
        }
    });

    return scores;
    // const is_data_beatmap = data[0].beatmapset_id !== undefined || data[0].set_id !== undefined;

    // let cloned_data = JSON.parse(JSON.stringify(data));

    // let split_array = [];
    // while (cloned_data.length > 0) {
    //     split_array.push(cloned_data.splice(0, BATCH_DIFF_DATA_FETCH));
    // }

    // let finished_scores = [];
    // let diff_data = {};
    // let index = 0;
    // let concurrent_queries = [];
    // for await (const _data of split_array) {
    //     let beatmap_id_mod_pairs = [];
    //     _data.forEach((__data) => {
    //         if(__data.mods?.star_rating){
    //             console.log(`Skipping ${__data.beatmap_id} (${__data.mods.star_rating})`);
    //             return;
    //         }

    //         let mods = custom_mods ? custom_mods : (force_all_mods ? undefined : CorrectMod(__data.enabled_mods));
    //         let pair = {
    //             beatmap_id: __data.beatmap_id,
    //             mode: 0,
    //             mods: mods
    //         };

    //         //unset mods if mods is undefined
    //         if (pair.mods === undefined) {
    //             delete pair.mods;
    //         }

    //         beatmap_id_mod_pairs.push(pair);
    //     });

    //     let concurrent_query = function (pairs, _index) {
    //         return new Promise(async (resolve, reject) => {
    //             // let _diff_data = await InspectorBeatmapDifficulty.findAll({
    //             //     where: {
    //             //         [Sequelize.Op.or]: pairs
    //             //     },
    //             //     raw: true,
    //             //     logging: console.log
    //             // });
    //             let _diff_data = await Databases.inspector.query(`
    //                 SELECT * FROM beatmap_difficulty_attrib WHERE beatmap_id = ANY($1) AND mode = ANY($2) AND mods = ANY($3);
    //             `, {
    //                 bind: [
    //                     pairs.map(p => p.beatmap_id),
    //                     pairs.map(p => p.mode),
    //                     pairs.map(p => p.mods)
    //                 ],
    //                 type: Sequelize.QueryTypes.SELECT
    //             });

    //             resolve(_diff_data);
    //         }).then((_diff_data) => {
    //             _diff_data.forEach((_diff) => {
    //                 // diff_data.push(_diff);
    //                 const key = `${_diff.beatmap_id}_${_diff.mode}_${_diff.mods}`;
    //                 diff_data[key] = _diff;
    //             });
    //         }).catch((err) => {
    //             console.error(err);
    //         });
    //     }

    //     if(beatmap_id_mod_pairs.length == 0){
    //         continue;
    //     }

    //     concurrent_queries.push(concurrent_query(beatmap_id_mod_pairs, index));
    //     index++;
    // }

    // console.log(`============================================================================================`);
    // console.log(`Running ${concurrent_queries.length} queries concurrently (${BATCH_DIFF_DATA_FETCH} each)`);
    // console.log(`scores: ${data.length}`);
    // console.time('All queries');
    // await Promise.all(concurrent_queries);
    // console.timeEnd('All queries');
    // console.log(`============================================================================================`);
    // console.log(`Applying difficulty data to scores`);
    // console.time('Apply');
    // for (let i = 0; i < data.length; i++) {
    //     let _data = data[i];

    //     if(_data.mods?.star_rating){
    //         if(is_data_beatmap){
    //             _data.difficulty_data = _data.mods;
    //         }else{
    //             _data.beatmap.difficulty_data = _data.mods;
    //             _data.mods = _data.mods.mods;
    //         }
    //         finished_scores.push(_data);
    //         continue;
    //     }else{
    //         if(!is_data_beatmap){
    //             _data.mods = undefined;
    //         }
    //     }

    //     let beatmap_id = _data.beatmap_id;
    //     let mods = CorrectMod(_data.enabled_mods);
    //     // let _diff = diff_data.find(d => d.beatmap_id == beatmap_id && d.mods == mods);
    //     let _diff = diff_data[`${beatmap_id}_${0}_${mods}`];

    //     if (_diff) {
    //         _diff.star_rating = _diff.diff_unified;
    //         _diff.aim_difficulty = _diff.diff_aim;
    //         _diff.speed_difficulty = _diff.diff_speed;
    //         _diff.flashlight_difficulty = _diff.flashlight_rating;
    //         _diff.overall_difficulty = _diff.od;
    //         _diff.approach_rate = _diff.ar;

    //         delete _diff.diff_strain;
    //         delete _diff.diff_unified;
    //         delete _diff.diff_aim;
    //         delete _diff.diff_speed;
    //         delete _diff.flashlight_rating;
    //         delete _diff.od;
    //         delete _diff.ar;

    //         if(is_data_beatmap){
    //             _data.difficulty_data = _diff;
    //         }else{
    //             _data.beatmap.difficulty_data = _diff
    //         }
    //     }

    //     finished_scores.push(_data);
    // }
    // console.timeEnd('Apply');
    // console.log(`============================================================================================`);
    // //parse the already existing difficulty data
    // console.log(`Parsing lazer difficulty data`);

    // console.log(`============================================================================================`);

    // return finished_scores;
}