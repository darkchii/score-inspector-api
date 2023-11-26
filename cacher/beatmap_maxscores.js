const { Op, Sequelize } = require("sequelize");
const { InspectorBeatmap, InspectorBeatmapMaxScore } = require("../helpers/db.js");
const { default: axios } = require("axios");
const bparser = require("bparser-js");
//
const mods = [0, 2, 4, 6, 16, 20, 64, 66, 68, 70, 80, 84, 256, 258, 260, 262, 272, 276, 1024, 1026, 1028, 1032, 1034, 1038, 1040, 1044, 1052, 1088, 1090, 1092, 1094, 1096, 1098, 1100, 1102, 1104, 1108, 1112, 1116, 1282, 1284, 1286, 1288, 1290, 1292, 1294, 1296, 1300, 1304, 1308];
module.exports.ProcessBeatmapMaxScores = ProcessBeatmapMaxScores;
async function ProcessBeatmapMaxScores() {
    //check for unprocessed beatmaps
    //if any mods is missing, we just reprocess beatmap_id for all mods

    //select from beatmap not in beatmap_maxscore
    const beatmaps = await InspectorBeatmap.findAll({
        attributes: ['beatmap_id'],
        where: {
            approved: { [Op.in]: [1, 2, 4] },
            mode: 0,
            beatmap_id: { [Op.notIn]: Sequelize.literal(`(SELECT beatmap_id FROM beatmap_maxscore)`) }
        },
        raw: true
    });

    let beatmaps_processed = 0;
    for await (const beatmap of beatmaps) {
        await ProcessBeatmap(beatmap);
        beatmaps_processed++;
        if (beatmaps_processed % 1000 === 0) console.log(`processed beatmap ${beatmap.beatmap_id} (${beatmaps_processed}/${beatmaps.length})`);
        // console.log(`processed beatmap ${beatmap.beatmap_id} (${beatmaps.indexOf(beatmap) + 1}/${beatmaps.length})`);
    }

    console.log(`found ${beatmaps.length} unprocessed beatmaps`);
}

async function ProcessBeatmap(beatmap) {
    //get .osu file from different api
    const { data } = await axios.get(`http://192.168.178.115:16791/dlb/${beatmap.beatmap_id}`);
    // console.log(data.length);
    const parsed = new bparser.BeatmapParser(data, 0, true);
    const max_scores = [];
    for (const mod of mods) {
        const max_score = parsed.getMaxScore(mod);
        if (max_score > 0) {
            max_scores.push({
                beatmap_id: beatmap.beatmap_id,
                mods: mod,
                max_score: max_score
            });
        }
    }

    //insert or update
    await InspectorBeatmapMaxScore.bulkCreate(max_scores, {
        updateOnDuplicate: ['max_score']
    });
}