//adds extra data to each user, like B, C and D ranks. Stats not available in the osu api
//its slow, so we only do it users that are in clans, since we need these stats for the clan page

const { Op } = require("sequelize");
const { InspectorUser, InspectorClanMember, InspectorClan, AltScore, InspectorOsuUser } = require("../helpers/db");
const { UpdateUser } = require("../helpers/osualt");

const cacher = {
    func: UpdateUsers,
    name: 'UpdateUsers',
}

module.exports = cacher;

async function UpdateUsers() {
    //get all users
    const users = await InspectorOsuUser.findAll({
        where: {
            playtime: { [Op.gt]: 0, },
            pp: { [Op.gt]: 0, },
            global_rank: { [Op.gt]: 0, },
            playcount: { [Op.gt]: 0, },
        },
        //randomize the order so we don't always update the same users first (like when the server restarts)
        order: [
            [InspectorOsuUser.sequelize.fn('RAND')],
        ],
    });
    console.log(`[CACHER] Found ${users.length} users ...`);

    //show how many hours it will likely take to update all users (750ms per user)
    console.log(`[CACHER] Estimated time to update all users: ${users.length * 0.75 / 60 / 60} hours ...`);

    for await (const user of users) {
        await UpdateUser(user.user_id);
    }

    console.log(`[CACHER] Updated ${users.length} users ...`);
}
