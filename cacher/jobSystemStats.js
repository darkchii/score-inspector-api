const { AltScore, AltUser, AltPriorityUser, InspectorScoreStat } = require("../helpers/db");

const cacher = {
    func: UpdateSystemInfo,
    name: 'UpdateSystemInfo',
}

module.exports = cacher;

async function UpdateSystemInfo(){
    const score_count = await AltScore.count();
    const user_count = await AltUser.count();
    const priority_user_count = await AltPriorityUser.count();

    const exists = await InspectorScoreStat.findOne({
        where: {
            key: 'system_info',
            period: 'any'
        }
    });

    if(exists){
        await InspectorScoreStat.update({
            value: JSON.stringify({
                score_count,
                user_count,
                priority_user_count
            })
        }, {
            where: {
                key: 'system_info',
                period: 'any'
            }
        });
    } else {
        await InspectorScoreStat.create({
            key: 'system_info',
            period: 'any',
            value: JSON.stringify({
                score_count,
                user_count,
                priority_user_count
            })
        });
    }
}