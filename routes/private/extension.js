const express = require('express');
var apicache = require('apicache');
const { VerifyToken, getFullUsers, GetInspectorUser } = require('../../helpers/inspector');
const { InspectorClanMember, InspectorClan, InspectorClanStats, AltScore, InspectorOsuUser, InspectorCompletionist, AltUser, GetHistoricalScoreRankModel, AltBeatmap, InspectorScoreStat } = require('../../helpers/db');
const { Op, Sequelize } = require('sequelize');
const { IsUserClanOwner } = require('../../helpers/clans');
const { MODE_SLUGS } = require('../../helpers/osu');
const { default: axios } = require('axios');
const router = express.Router();
require('dotenv').config();

let cache = apicache.middleware;

const RANK_STATS = [
    {
        stat: 'total_score',
        order: '(total_score)',
        dir: 'DESC'
    },
    {
        stat: 'ss',
        order: '(ssh_count + ss_count)',
        dir: 'DESC'
    },
    {
        stat: 's',
        order: '(sh_count + s_count)',
        dir: 'DESC'
    },
    {
        stat: 'a',
        order: '(a_count)',
        dir: 'DESC'
    },
    {
        stat: 'b',
        order: '(b_count)',
        dir: 'DESC'
    },
    {
        stat: 'c',
        order: '(c_count)',
        dir: 'DESC'
    },
    {
        stat: 'd',
        order: '(d_count)',
        dir: 'DESC'
    },
    {
        stat: 'clears',
        order: '(ss_count + ssh_count + s_count + sh_count + a_count)',
        dir: 'DESC'
    },
    {
        stat: 'playtime',
        order: '(playtime)',
        dir: 'DESC'
    },
    {
        stat: 'playcount',
        order: '(playcount)',
        dir: 'DESC'
    },
    {
        stat: 'replays_watched',
        order: '(replays_watched)',
        dir: 'DESC'
    },
    {
        stat: 'total_hits',
        order: '(total_hits)',
        dir: 'DESC'
    }
]

const RANK_PAGE_SIZE = 50;
router.get('/rank/:stat/:page/:country?', cache('1 hour'), async (req, res) => {
    const page = req.params.page;
    const stat = req.params.stat;
    const country = req.params.country || null;

    const statIndex = RANK_STATS.findIndex(s => s.stat === stat);

    if (statIndex === -1) {
        res.status(400).json({ error: 'Invalid stat' });
        return;
    }


    if (isNaN(page)) {
        res.status(400).json({ error: 'Invalid page number' });
        return;
    }

    try {
        const users = await InspectorOsuUser.findAll({
            where: country ? { country_code: country } : {},
            order: [[Sequelize.literal(RANK_STATS[statIndex].order), RANK_STATS[statIndex].dir]],
            limit: RANK_PAGE_SIZE,
            offset: (page - 1) * RANK_PAGE_SIZE
        });

        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Unable to get users', message: err.message });
    }
});

//this is a temporary cache for user data
//it will be used to reduce the amount of requests to the database
//max 1 hour
const user_local_cache = {};
const USER_CACHE_TIME = 900000; //10 minutes
router.post('/clans/users', async (req, res, next) => {
    //can be one or multiple ids, separated by commas
    // let ids = req.params.id.split(',');
    let ids = [];

    if (req.params.id) {
        ids = req.params.id.split(',');
    } else if (req.body.ids) {
        ids = req.body.ids;
    } else {
        res.status(400).json({ error: "Invalid user id" });
        return;
    }

    //check cache
    const now = new Date();
    let fetched_cached_data = [];
    //grab cached data for each id if its still valid and exists
    for (const id of ids) {
        if (user_local_cache[id] && user_local_cache[id].expires > now) {
            fetched_cached_data.push(user_local_cache[id].data);
        }
    }

    //clean up cache for expired data
    for (const data of Object.keys(user_local_cache)) {
        if (user_local_cache[data].expires < now) {
            delete user_local_cache[data];
        }
    }

    //only numbers are allowed
    ids = ids.filter(id => !isNaN(id));

    //dont fetch users that are in fetched_cached_data (fetched_cached_data.data.osu_id)
    ids = ids.filter(id => !fetched_cached_data.find(d => d.osu_id == id));

    if (ids.length == 0 && fetched_cached_data.length == 0) {
        res.status(400).json({ error: "Invalid user id" });
        return;
    }

    //we only care about clan info, not user info
    const members = await InspectorClanMember.findAll({
        where: {
            osu_id: ids,
            pending: false
        },
        include: [
            {
                model: InspectorClan,
                as: 'clan'
            }
        ]
    });

    //put the data in the cache if it doesn't exist
    for (const member of members) {
        if (!user_local_cache[member.osu_id]) {
            user_local_cache[member.osu_id] = {
                data: member,
                expires: new Date(now.getTime() + USER_CACHE_TIME)
            };
        }
    }

    const merged_data = fetched_cached_data.concat(members || []);

    if (merged_data.length == 0) {
        res.status(404).json({ error: "No data found" });
        return;
    }

    res.json(merged_data);
});

let beatmap_count_cache = -1;
//minimum 1 hour
let beatmap_count_cache_last_updated = null;

let profile_cache = {};
router.post('/profile', async (req, res, next) => {
    try {
        const id = req.body.user_id;
        const username = req.body.username;
        const mode = req.body.mode !== undefined ? req.body.mode : 0;
        if (!id || isNaN(id)) {
            res.status(400).json({ error: "Invalid user id" });
            return;
        }

        //check cache
        // if (profile_cache[`${id}_${mode}`] && profile_cache[`${id}_${mode}`].expires > new Date()) {
        //     res.json(profile_cache[`${id}_${mode}`].data);
        //     return;
        // }

        if(beatmap_count_cache == -1 || (new Date() - beatmap_count_cache_last_updated) > 3600000) {
            const c = await InspectorScoreStat.findOne({
                where: {
                    key: 'system_info'
                }
            })
            const _c = JSON.parse(c?.value);
            beatmap_count_cache = _c?.beatmap_count ?? 120000; //placeholder value, extremely inaccurate
            beatmap_count_cache_last_updated = new Date();
        }

        const [user, scoreRankHistory, top50sData, currentScoreRank, completion, clan] = await Promise.allSettled([
            mode == 0 ? InspectorOsuUser.findOne({ where: { user_id: id }, raw: true }) : null,
            (GetHistoricalScoreRankModel(MODE_SLUGS[mode])).findAll({
                where: {
                    [Op.and]: [
                        { osu_id: id },
                        { date: { [Op.gte]: new Date(new Date() - 90 * 24 * 60 * 60 * 1000) } }
                    ]
                },
                order: [
                    ['date', 'ASC']
                ],
            }),
            axios.post('https://osustats.ppy.sh/api/getScores', {
                accMax: "100",
                gamemode: mode,
                page: "1",
                rankMax: "50",
                rankMin: "1",
                resultType: "1",
                sortBy: "0",
                sortOrder: "0",
                u1: username
            }),
            axios.get(`https://score.respektive.pw/u/${id}?m=${mode}`, {
                headers: { "Accept-Encoding": "gzip,deflate,compress" }
            }),
            InspectorCompletionist.findAll({
                where: {
                    osu_id: id
                }
            }),
            InspectorClanMember.findOne({
                where: {
                    osu_id: id,
                    pending: false
                },
                include: [
                    {
                        model: InspectorClan,
                        as: 'clan'
                    }
                ]
            })
        ]);

        const _data = {
            user: user?.value ? {
                ...user.value,
                completion: (100 / beatmap_count_cache) * (user.value.alt_ssh_count + user.value.alt_ss_count + user.value.alt_sh_count + user.value.alt_s_count + user.value.alt_a_count + user.value.b_count + user.value.c_count + user.value.d_count)
            } : null,
            stats: {
                top50s: top50sData?.value?.data?.[1] ?? [],
                scoreRank: currentScoreRank?.value?.data?.[0]?.rank ?? 0
            },
            scoreRankHistory: scoreRankHistory?.value ?? [],
            completion: completion?.value ?? [],
            clan: clan?.value ?? null
        };

        //remove all expired cache
        for (const data of Object.keys(profile_cache)) {
            if (profile_cache[data].expires < new Date()) {
                delete profile_cache[data];
            }
        }

        profile_cache[`${id}_${mode}`] = {
            data: _data,
            expires: new Date(new Date().getTime() + USER_CACHE_TIME)
        };

        res.json(_data);
    } catch (err) {
        res.status(500).json({ error: 'Unable to get user', message: err.message });
    }
});

let coe_attendees_cache = {
    data: [],
    expires: null
};

router.get('/coe/:id', cache('1 hour'), async (req, res) => {
    try{
        let coe_attendees = [];
    
        if(coe_attendees_cache.expires && coe_attendees_cache.expires > new Date()) {
            coe_attendees = coe_attendees_cache.data;
        } else {
            const _data = await axios.get('https://cavoeboy.com/api/attendees');
            coe_attendees = _data.data;
    
            coe_attendees_cache = {
                data: coe_attendees,
                //cache for 1 hour
                expires: new Date(new Date().getTime() + 3600000)
            };
        }

        let user = coe_attendees.find(u => u.user.osuUser?.id == req.params.id);
        if(!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json(user);
    }catch(err){
        console.error(err);
        res.status(500).json({ error: 'Unable to get data', message: err.message });
    }
});

module.exports = router;