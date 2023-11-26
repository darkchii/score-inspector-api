//keeps track of cheated scores
//currently only checks for scores that exceed maxscore
//a bit complex, since we need to use inspector db to get beatmaps and maxscore
//and osu!alt db to get scores

const { Op } = require("sequelize");
const { InspectorBeatmap, Databases, InspectorBeatmapMaxScore, InspectorCheatedScore } = require("../helpers/db.js");
const { GetModMultiplier, sleep, CorrectMod, CorrectModScore, ModsToString } = require("../helpers/misc.js");
const { GetBeatmapScores } = require("../helpers/osu.js");

const tables = ['top_score', 'top_score_hidden', 'top_score_nomod'];

module.exports.getCheatedScores = getCheatedScores;
async function getCheatedScores() {
    console.log('[CHEAT SCANNER] Getting cheated scores');

    for await (const table of tables) {
        console.log(`[CHEAT SCANNER] Getting cheated scores from ${table}`);
        const top_scores = await getTopScores(table);

        let mod_check = null;
        if(table==='top_score_hidden'){
            mod_check = 8;
        }else if(table==='top_score_nomod'){
            mod_check = 0;
        }
    
        const data = await parseCheatedScores(top_scores);
        // await checkForValidity(data, mod_check);
        debugCheatedScores(data);
        await upsertCheatedScores(data);
        console.log(`[CHEAT SCANNER] Finished ${table}`);
    }

    //get all top scores
}

async function parseCheatedScores(top_scores) {
    const cheated_scores = [];
    for await (const score of top_scores) {
        const correctedMods = CorrectModScore(parseInt(score.enabled_mods));
        const max_score_res = await InspectorBeatmapMaxScore.findOne({
            attributes: ['max_score'],
            where: {
                beatmap_id: score.beatmap_id,
                mods: correctedMods
            },
            raw: true
        });
        if (!max_score_res) continue;
        const max_score = max_score_res.max_score;


        if (score.score > max_score) {
            let reason = '';
            //if score older than
            const year = score.date_played.getFullYear();
            const overflow = score.score - max_score;
            if (year < 2010) {
                reason = 'old';
            } else if (overflow <= 1100) {
                reason = 'spinner';
            } else {
                reason = 'cheated';
            }
            cheated_scores.push({
                user_id: score.user_id,
                beatmap_id: score.beatmap_id,
                score: score,
                max_score: max_score,
                reason: reason,
                corrected_mods: correctedMods,
                deleted: false,
            });
        }
    };

    return cheated_scores;
}

async function checkForValidity(cheated_scores, mods = null) {
    //checks if a score still exists on official osu
    let index = 0;
    for await (const score of cheated_scores) {
        index++;
        console.log(`[CHEAT SCANNER] (${index}/${cheated_scores.length}) checking user ${score.user_id} beatmap ${score.beatmap_id}`);
        if (!score.reason === 'cheated') continue;
        const data = await GetBeatmapScores(score.beatmap_id, 'osu', mods);
        const top_score = data.scores[0];

        if (top_score.user_id === score.user_id && top_score.score === score.score.score) {
            score.deleted = false;
        } else {
            score.deleted = true;
        }

        await sleep(100);
    }
}

async function upsertCheatedScores(cheated_scores) {
    const reparsed_cheated_scores = [];

    cheated_scores.forEach(score => {
        let _score = {
            ...score.score,
            is_deleted: score.deleted ? 1 : 0
        }
        _score.enabled_mods = parseInt(_score.enabled_mods);
        _score.accuracy = parseFloat(_score.accuracy);
        _score.pp = parseFloat(_score.pp);
        _score.date_deleted = null;
        _score.reason = score.reason;
        if(score.deleted) {
            _score.date_deleted = new Date();
        }
        reparsed_cheated_scores.push(_score);
    });

    //insert or update
    await InspectorCheatedScore.bulkCreate(reparsed_cheated_scores, {
        updateOnDuplicate: ['is_deleted', 'date_deleted', 'reason']
    });
}

async function debugCheatedScores(cheated_scores) {
    const _cheated_scores = [];

    cheated_scores.forEach(score => {
        _cheated_scores.push({
            user_id: score.user_id,
            beatmap_id: score.beatmap_id,
            score: score.score.score,
            max_score: score.max_score,
            overflow_percent: Math.round((score.score.score - score.max_score) / score.max_score * 10000) / 100,
            overflow: score.score.score - score.max_score,
            reason: score.reason,
            enabled_mods: ModsToString(score.score.enabled_mods),
            corrected_mods: ModsToString(score.corrected_mods),
            deleted: score.deleted,
        });
    });

    //only cheated scores
    console.table(_cheated_scores.filter(score => score.reason === 'cheated'));
}

async function getTopScores(table) {
    return (await Databases.osuAlt.query(`
        SELECT s.* FROM ${table} ts
        INNER JOIN scores s
        ON ts.beatmap_id = s.beatmap_id AND ts.user_id = s.user_id
    `))[0];
}