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
    //get the first random map
    const first_random_map = await AltBeatmap.findOne({
        order: Sequelize.literal('random()'),
        where: {
            approved: {
                [Op.in]: [1, 2, 4]
            }
        }
    });

    console.log(`[MapPoll] Base stars: ${first_random_map.stars}`);

    //find 5 random maps that have a similar star rating to the first map
    const beatmaps = await AltBeatmap.findAll({
        order: Sequelize.literal('random()'),
        limit: amount,
        where: {
            approved: {
                [Op.in]: [1, 2, 4]
            },
            stars: {
                [Op.between]: [first_random_map.stars - 1, first_random_map.stars + 1]
            }
        }
    });

    console.log(`[MapPoll] Found ${beatmaps.length} maps`);
    console.log(`[MapPoll] Stars: ${beatmaps.map(b => b.stars).join(', ')}`);

    //if we have less than 5 maps, fill the rest with random maps
    if(beatmaps.length < amount){
        const random_maps = await AltBeatmap.findAll({
            order: Sequelize.literal('random()'),
            limit: amount - beatmaps.length,
            where: {
                approved: {
                    [Op.in]: [1, 2, 4]
                },
                beatmap_id: {
                    [Op.notIn]: beatmaps.map(b => b.beatmap_id)
                }
            }
        });

        console.log(`[MapPoll] Found ${random_maps.length} random maps to fill missing slots`);

        beatmaps.push(...random_maps);
    }

    return beatmaps;
}