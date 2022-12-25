const { Client } = require("pg");
require('dotenv').config();

const beatmap_columns = `
beatmaps.approved, 
    beatmaps.submit_date, 
    beatmaps.approved_date, 
    beatmaps.last_update,
    beatmaps.artist,
    beatmaps.set_id,
    beatmaps.bpm,
    beatmaps.creator,
    beatmaps.creator_id,
    beatmaps.stars,
    beatmaps.diff_aim,
    beatmaps.diff_speed,
    beatmaps.cs,
    beatmaps.od,
    beatmaps.ar,
    beatmaps.hp,
    beatmaps.drain,
    beatmaps.source,
    beatmaps.genre,
    beatmaps.language,
    beatmaps.title,
    beatmaps.length,
    beatmaps.diffname,
    beatmaps.file_md5,
    beatmaps.mode,
    beatmaps.tags,
    beatmaps.favorites,
    beatmaps.rating,
    beatmaps.playcount,
    beatmaps.passcount,
    beatmaps.maxcombo,
    beatmaps.circles,
    beatmaps.sliders,
    beatmaps.spinners,
    beatmaps.storyboard,
    beatmaps.video,
    beatmaps.download_unavailable,
    beatmaps.audio_unavailable,
    beatmaps.beatmap_id
`;

const score_columns = `
    scores.user_id, 
    scores.beatmap_id, 
    scores.score, 
    scores.count300, 
    scores.count100, 
    scores.count50, 
    scores.countmiss, 
    scores.combo, 
    scores.perfect, 
    scores.enabled_mods, 
    scores.date_played, 
    scores.rank, 
    scores.pp, 
    scores.accuracy, 
    ${beatmap_columns},
    moddedsr.star_rating,
    moddedsr.aim_diff,
    moddedsr.speed_diff,
    moddedsr.fl_diff,
    moddedsr.slider_factor,
    moddedsr.speed_note_count,
    moddedsr.modded_od,
    moddedsr.modded_ar,
    moddedsr.modded_cs,
    moddedsr.modded_hp
`;

const score_columns_full = `
    scores.user_id, 
    scores.beatmap_id, 
    scores.score, 
    scores.count300, 
    scores.count100, 
    scores.count50, 
    scores.countmiss, 
    scores.combo, 
    scores.perfect, 
    scores.enabled_mods, 
    scores.date_played, 
    scores.rank, 
    scores.pp, 
    scores.accuracy, 
    ${beatmap_columns},
    moddedsr.star_rating,
    moddedsr.aim_diff,
    moddedsr.speed_diff,
    moddedsr.fl_diff,
    moddedsr.slider_factor,
    moddedsr.speed_note_count,
    moddedsr.modded_od,
    moddedsr.modded_ar,
    moddedsr.modded_cs,
    moddedsr.modded_hp,
    pack_id
    `;
module.exports.score_columns = score_columns;
module.exports.beatmap_columns = beatmap_columns;
module.exports.score_columns_full = score_columns_full;

module.exports.IsRegistered = IsRegistered;
async function IsRegistered(id) {
    let data;
    try {
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();
        const { rows } = await client.query('SELECT count(*) FROM priorityuser WHERE user_id = $1', [id]);
        // const { rows } = await client.query('SELECT count(*) FROM priorityuser');
        await client.end();
        data = { registered: rows[0].count > 0 };
    } catch (err) {
        throw new Error('Something went wrong, please try later...');
    }
    return data;
}

module.exports.GetAllUsers = GetAllUsers;
async function GetAllUsers() {
    let data;
    try {
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();
        const { rows } = await client.query('SELECT priorityuser.user_id, users2.username FROM priorityuser LEFT JOIN users2 ON priorityuser.user_id = users2.user_id WHERE username IS NOT NULL');
        await client.end();
        data = rows;
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}

module.exports.GetUser = GetUser;
async function GetUser(id) {
    let data;
    try {
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();
        const { rows } = await client.query(`SELECT * FROM users2 WHERE user_id=$1`, [id]);
        await client.end();
        if (rows.length > 0) {
            data = rows[0];
        } else {
            throw new Error('User not found');
        }
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}

module.exports.FindUser = FindUser;
async function FindUser(query, single) {
    let data;
    try {
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();
        let _where = ``;
        if (single) {
            _where = `WHERE users2.user_id::text = $1 OR (LOWER(username) = LOWER($2))`;
        } else {
            _where = `WHERE users2.user_id::text = $1 OR (LOWER(username) SIMILAR TO LOWER($2))`;
        }
        const { rows } = await client.query(`
          SELECT ${single ? `*` : `priorityuser.user_id as user_id, users2.username, users2.country_code`} FROM priorityuser 
          LEFT JOIN users2 ON priorityuser.user_id = users2.user_id 
          ${_where} ${single ? 'LIMIT 1' : ''}`, [query, single ? `${query}` : `%${query}%`]);
        await client.end();
        if (single) {
            if (rows.length == 0)
                throw new Error('No user found');
            else
                data = rows[0];
        } else {
            data = rows;
        }
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}

module.exports.GetBestScores = GetBestScores;
async function GetBestScores(period, stat, limit, loved = false) {
    let data;
    try {
        let period_check = null;
        switch (period) {
            case 'day':
                period_check = 1;
                break;
            case 'week':
                period_check = 7;
                break;
            case 'month':
                period_check = 31;
                break;
            case 'year':
                period_check = 365;
                break;
            case 'all':
                period_check = null;
                break;
        }
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();
        const approved_query = `(beatmaps.approved = 1 OR beatmaps.approved = 2 ${loved ? 'OR beatmaps.approved = 4' : ''})`;
        const { rows } = await client.query(`
        SELECT ${score_columns}, users2.pp as user_pp, users2.username FROM scores 
        LEFT JOIN beatmaps ON scores.beatmap_id = beatmaps.beatmap_id
        LEFT JOIN moddedsr on beatmaps.beatmap_id = moddedsr.beatmap_id and moddedsr.mods_enum = (case when is_ht = 'true' then 256 else 0 end + case when is_dt = 'true' then 64 else 0 end + case when is_hr = 'true' then 16 else 0 end + case when is_ez = 'true' then 2 else 0 end + case when is_fl = 'true' then 1024 else 0 end) 
        INNER JOIN users2 ON scores.user_id = users2.user_id 
        WHERE ${period_check !== null ? `date_played > current_date - ${period_check} AND ` : ''} ${approved_query} ORDER BY scores.${stat} DESC LIMIT $1`, [limit]);
        await client.end();
        data = rows;
    } catch (err) {
        console.error(err);
        throw new Error(err.message);
    }
    return data;
}
