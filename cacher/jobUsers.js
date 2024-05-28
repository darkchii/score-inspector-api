//adds extra data to each user, like B, C and D ranks. Stats not available in the osu api
//its slow, so we only do it users that are in clans, since we need these stats for the clan page

const { InspectorUser, InspectorClanMember, InspectorClan, AltScore } = require("../helpers/db");
const { UpdateUser } = require("../helpers/osualt");

const cacher = {
    func: UpdateUsers,
    name: 'UpdateUsers',
}

module.exports = cacher;

async function UpdateUsers() {
    //get all users
    const users = await InspectorUser.findAll({
        include: [
            {
                model: InspectorClanMember,
                as: 'clan_member',
                required: true,
                where: {
                    pending: false
                },
                include: [
                    {
                        model: InspectorClan,
                        as: 'clan',
                        required: true
                    }
                ]
            }
        ]
    });

    for await (const user of users) {
        await UpdateUser(user.osu_id);
    }

    console.log(`[CACHER] Updated ${users.length} users ...`);
}
