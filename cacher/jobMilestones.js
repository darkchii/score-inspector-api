const { InspectorOsuUser, AltUser, InspectorUserMilestone } = require("../helpers/db");

const cacher = {
    func: UpdateUsers,
    name: 'UpdateUsers',
}

module.exports = cacher;

//for example, if old user has 3950, and new one has 4005, then they get an achievement for reaching 4000
//if old or new is -1, ignore
const ACHIEVEMENT_INTERVALS = [
    {
        name: 'Total SS',
        stats: ['ssh_count', 'ss_count'], //sum
        dir: '>',
        interval: 1000 //every 1000 ss is an achievement
    },
    {
        name: 'Total S',
        stats: ['sh_count', 's_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Silver SS',
        stats: ['ssh_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Silver S',
        stats: ['sh_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Gold SS',
        stats: ['ss_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Gold S',
        stats: ['s_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'A',
        stats: ['a_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Clears',
        stats: ['ssh_count', 'ss_count', 'sh_count', 's_count', 'a_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Ranked Score',
        stats: ['ranked_score'],
        dir: '>',
        interval: 10000000000
    }, {
        name: 'Total Score',
        stats: ['total_score'],
        dir: '>',
        interval: 10000000000
    }, {
        name: 'PP',
        stats: ['pp'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Playtime',
        stats: ['playtime'],
        dir: '>',
        interval: 360000 //every 100 hours is a milestone
    }, {
        name: 'Playcount',
        stats: ['playcount'],
        dir: '>',
        interval: 10000
    }, {
        name: 'Level',
        stats: ['level'],
        dir: '>',
        interval: 1
    }, {
        name: 'Global Rank',
        stats: ['global_rank'],
        dir: '<',
        interval: 100000, //every 100000 ranks is a milestone
        intervalAlternative: [
            {
                dir: '<',
                check: 200000,
                interval: 10000 //if rank under 200000, every 10000 ranks is a milestone
            },
            {
                dir: '<',
                check: 10000,
                interval: 1000 //if rank under 10000, every 1000 ranks is a milestone
            },
            {
                dir: '<',
                check: 1000,
                interval: 100 //if rank under 1000, every 100 ranks is a milestone
            },
            {
                dir: '<',
                check: 100,
                interval: 10 //if rank under 100, every 10 ranks is a milestone
            }
        ]
    }
]

async function UpdateUsers() {
    //get column names from InspectorOsuUser
    const columns = Object.keys(InspectorOsuUser.rawAttributes);
    const exclude = ['b_count', 'c_count', 'd_count', 'total_pp']
    const actual_columns = columns.filter(x => !exclude);

    const remote_users = await AltUser.findAll({
        attributes: actual_columns,
        raw: true
    });
    const local_users = await InspectorOsuUser.findAll({
        attributes: actual_columns,
        raw: true
    });

    //check if any stat went over a threshold for achievement
    for await (const user of remote_users) {
        const local_user = local_users.find(x => x.user_id === user.user_id);
        if (!local_user) continue;

        for await (const achievement of ACHIEVEMENT_INTERVALS) {
            let old_stat = 0;
            let new_stat = 0;
            for await (const stat of achievement.stats) {
                old_stat += parseInt(local_user[stat]);
                new_stat += parseInt(user[stat]);
            }

            if (old_stat === -1 || new_stat === -1) continue;

            let interval = achievement.interval;

            if (achievement.intervalAlternative) {
                for await (const alt of achievement.intervalAlternative) {
                    if (alt.dir === '<' && new_stat < alt.check && interval > alt.interval) {
                        interval = alt.interval;
                    } else if (alt.dir === '>' && new_stat > alt.check && interval < alt.interval) {
                        interval = alt.interval;
                    }
                }
            }

            let normalized_old_stat = Math.floor(old_stat / interval);
            let normalized_new_stat = Math.floor(new_stat / interval);

            if (normalized_old_stat === normalized_new_stat) continue;
            if (achievement.dir === '>' && normalized_new_stat < normalized_old_stat) continue;
            if (achievement.dir === '<' && normalized_new_stat > normalized_old_stat) continue;

            const reached_milestone = achievement.dir === '>' ? normalized_new_stat : normalized_old_stat;

            await InspectorUserMilestone.create({
                user_id: user.user_id,
                achievement: achievement.name,
                count: reached_milestone * interval,
                time: new Date()
            });
            console.log(`[MILESTONE] ${user.username} reached ${reached_milestone * interval} (${achievement.name})`)
        }
    }

    // //insert or update all users in InspectorOsuUser
    await InspectorOsuUser.bulkCreate(remote_users, {
        updateOnDuplicate: actual_columns
    });
}