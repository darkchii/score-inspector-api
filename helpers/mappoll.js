const { default: Sequelize, Op } = require("@sequelize/core");
const { InspectorMapPoll, AltBeatmap } = require("./db");
const { db_now } = require("./misc");
const { v4: uuidv4 } = require('uuid');

module.exports.updateMapPoll = updateMapPoll;
async function updateMapPoll(){
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

module.exports.getCurrentPoll = getCurrentPoll;
async function getCurrentPoll() {
    const currentPollSet = await InspectorMapPoll.findAll({
        where: {
            date: new Date().toDateString()
        }
    });

    if (currentPollSet.length === 0) return null;

    const currentPoll = {
        id: currentPollSet[0].poll_id,
        date: currentPollSet[0].date,
        map_ids: currentPollSet.map(poll => poll.beatmap_id)
    }

    return currentPoll;
}

module.exports.createNewPoll = createNewPoll;
async function createNewPoll(map_ids) {
    //for every map_id, create a new poll entry
    const uuid = uuidv4();
    for (let i = 0; i < map_ids.length; i++) {
        const newPoll = await InspectorMapPoll.create({
            date: new Date(),
            poll_id: uuid,
            beatmap_id: map_ids[i]
        });
    }
}

async function GetRandomMaps(amount = 5) {
    //get the first random map
    const first_random_map = await AltBeatmap.findOne({
        order: Sequelize.literal('random()'),
        where: {
            approved: {
                [Op.in]: [1, 2, 4]
            },
            mode: 0
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
            },
            mode: 0
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