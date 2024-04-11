const { Sequelize, Op } = require("sequelize");
const { AltBeatmap } = require("../helpers/db");
const { getCurrentPoll, createNewPoll } = require("../helpers/mappoll");

const cacher = {
    func: UpdateMapPoll,
    name: 'UpdateMapPoll',
}

module.exports = cacher;

async function UpdateMapPoll() {
    //check today's poll

    const currentPoll = await getCurrentPoll();
    console.log(new Date());

    //if the current poll is from yesterday, store results and generate a new poll

    if (currentPoll) {
        const date = new Date(currentPoll.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log(currentPoll);

        if (date.toDateString() === today.toDateString()) {
            console.log(`[MapPoll] Poll already exists for today, skipping...`);
            return;
        }
    }

    // console.log("meow");
    console.log(`[MapPoll] Generating new poll...`);
    const beatmaps = await GetRandomMaps(5);
    const ids = beatmaps.map(b => b.beatmap_id)

    await createNewPoll(ids);

    console.log(`[MapPoll] Updated map poll`);
}

async function GetRandomMaps(amount = 5) {
    const beatmaps = await AltBeatmap.findAll({
        order: Sequelize.literal('random()'),
        limit: amount,
        where: {
            approved: {
                [Op.in]: [1, 2, 4]
            }
        }
    });

    return beatmaps;
}