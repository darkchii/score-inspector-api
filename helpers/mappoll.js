const { InspectorMapPoll } = require("./db");
const { db_now } = require("./misc");
const { v4: uuidv4 } = require('uuid');

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
