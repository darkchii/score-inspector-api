var express = require('express');
var router = express.Router();
const { Client } = require('pg');
require('dotenv').config();

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

// pack_id

/* Get the entire list of scores of a user */
router.get('/:id', async function (req, res, next) {
    const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
    await client.connect();
    const approved_query = `AND (beatmaps.approved = 1 OR beatmaps.approved = 2 ${req.query.loved === 'true' ? 'OR beatmaps.approved = 4' : ''})`;
    const { rows } = await client.query(`
        SELECT ${score_columns} FROM scores 
        LEFT JOIN beatmaps ON scores.beatmap_id = beatmaps.beatmap_id 
        LEFT JOIN moddedsr on beatmaps.beatmap_id = moddedsr.beatmap_id and moddedsr.mods_enum = (case when is_ht = 'true' then 256 else 0 end + case when is_dt = 'true' then 64 else 0 end + case when is_hr = 'true' then 16 else 0 end + case when is_ez = 'true' then 2 else 0 end + case when is_fl = 'true' then 1024 else 0 end) 
        LEFT join (select beatmap_id, STRING_AGG(pack_id, ',') as pack_id from beatmap_packs group by beatmap_id) bp on beatmaps.beatmap_id = bp.beatmap_id 
        WHERE user_id=$1 ${approved_query}`, [req.params.id]);
    await client.end();
    res.json(rows);
});

module.exports = router;
