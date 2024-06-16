const { UpdateClan } = require("../helpers/clans");
const { InspectorClan, InspectorClanMember, InspectorOsuUser, InspectorClanStats, AltScore } = require("../helpers/db");
const { UpdateUser } = require("../helpers/osualt");

const cacher = {
    func: UpdateClans,
    name: 'UpdateClans',
}

module.exports = cacher;

async function UpdateClans() {
    //get all clans
    const clans = await InspectorClan.findAll();

    for await (const clan of clans) {
        await UpdateClan(clan.id);
    }
}
//a perma loop, constantly updating clan users
async function _updateUsers() {
    console.time('Updated users');
    const members = await InspectorClanMember.findAll({
        where: {
            pending: false
        }
    });
    for await (const member of members) {
        try {
            await UpdateUser(member.osu_id);
        } catch (err) {
            console.error(err);
        }
    }
    await new Promise(r => setTimeout(r, 600000));
    _updateUsers();
}

if (process.env.NODE_ENV === 'production') {
    _updateUsers();
}
