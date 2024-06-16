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
