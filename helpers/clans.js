const { InspectorClanMember, InspectorOsuUser, InspectorClanStats, AltScore, InspectorClan } = require("./db");

async function UpdateClan(id) {
    const data = {
        total_ss: 0,
        total_ssh: 0,
        total_s: 0,
        total_sh: 0,
        total_a: 0,
        total_b: 0,
        total_c: 0,
        total_d: 0,
        playcount: 0,
        playtime: 0,
        ranked_score: 0,
        total_score: 0,
        replays_watched: 0,
        total_hits: 0,
        average_pp: 0,
        total_pp: 0,
        accuracy: 0,
        clears: 0
    };

    let temp_sum_pp = 0;
    let temp_sum_acc = 0;

    //get all members of the clan
    const members = await InspectorClanMember.findAll({
        where: {
            clan_id: id,
            pending: false
        }
    });

    if (members.length === 0) {
        console.warn(`Clan ${id} has no members`);
        return;
    }

    const ids = members.map(m => m.osu_id);

    //we only use local data, not osu api, too many requests
    const local_users = await InspectorOsuUser.findAll({
        where: {
            user_id: ids
        }
    });

    local_users.forEach(u => {
        data.total_ss += u.ss_count;
        data.total_ssh += u.ssh_count;
        data.total_s += u.s_count;
        data.total_sh += u.sh_count;
        data.total_a += u.a_count;
        data.total_b += (u.b_count ?? 0);
        data.total_c += (u.c_count ?? 0);
        data.total_d += (u.d_count ?? 0);
        data.total_pp += (u.total_pp ?? 0);
        data.playcount += u.playcount;
        data.playtime += u.playtime;
        data.ranked_score += u.ranked_score;
        data.total_score += u.total_score;
        data.replays_watched += u.replays_watched;
        data.total_hits += u.total_hits;
        data.clears += u.ss_count + u.s_count + u.sh_count + u.ssh_count + u.a_count + (u.b_count ?? 0) + (u.c_count ?? 0) + (u.d_count ?? 0);
        temp_sum_pp += u.pp;
        temp_sum_acc += u.hit_accuracy;
    });

    // data.average_pp = temp_sum_pp / members.length;
    data.accuracy = temp_sum_acc / local_users.length;

    //sort
    local_users.sort((a, b) => b.pp - a.pp);
    //weighted clan pp, based on user profile pp
    let total_pp = 0;
    const weight = 0.5;

    local_users.forEach((u, index) => {
        const _weight = Math.pow(weight, index);
        total_pp += u.pp * _weight;
    });

    data.average_pp = total_pp;

    //update stats
    let stats = await InspectorClanStats.findOne({
        where: {
            clan_id: id
        }
    });

    for (const key in data) {
        stats[key] = data[key];
    }

    console.log(`Updated clan ${id}`);

    await stats.save();
}
module.exports.UpdateClan = UpdateClan;

async function IsUserClanOwner(user_id, clan_id) {
    const clan = await InspectorClan.findOne({
        where: {
            id: clan_id
        }
    });

    if (clan.owner === user_id) {
        return true;
    }

    return false;
}
module.exports.IsUserClanOwner = IsUserClanOwner;
