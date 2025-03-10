const express = require('express');
var apicache = require('apicache');
const { InspectorOsuUser, InspectorCompletionist, GetHistoricalScoreRankModel, InspectorScoreStat } = require('../../helpers/db');
const { MODE_SLUGS } = require('../../helpers/osu');
const { default: axios } = require('axios');
const { default: Sequelize, Op } = require('@sequelize/core');
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

const USER_CACHE_TIME = 900000; //10 minutes
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
        if (profile_cache[`${id}_${mode}`] && profile_cache[`${id}_${mode}`].expires > new Date()) {
            res.json(profile_cache[`${id}_${mode}`].data);
            return;
        }

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

        const [user, scoreRankHistory, top50sData, currentScoreRank, completion] = await Promise.allSettled([
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
            }, {
                timeout: 3000
            }),
            axios.get(`https://score.respektive.pw/u/${id}?m=${mode}`, {
                headers: { "Accept-Encoding": "gzip,deflate,compress" }
            }),
            InspectorCompletionist.findAll({
                where: {
                    osu_id: id
                }
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
            completion: completion?.value ?? []
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

router.post('/score_rank_history/:mode', async (req, res) => {
    try {
        const mode = req.params.mode;
        const ids = req.body.ids;

        //for each ID, get the oldest date, max 30 days old
        const scoreRankHistory = await GetHistoricalScoreRankModel(MODE_SLUGS[mode]).findAll({
            where: {
                [Op.and]: [
                    { osu_id: ids },
                    { date: { [Op.gte]: new Date(new Date() - 30 * 24 * 60 * 60 * 1000) } }
                ]
            },
            order: [
                ['date', 'ASC']
            ],
        });

        //for each user, get the oldest date entry only
        const _scoreRankHistory = scoreRankHistory.reduce((acc, current) => {
            if (!acc[current.osu_id]) {
                acc[current.osu_id] = current;
            } else if (current.date < acc[current.osu_id].date) {
                acc[current.osu_id] = current;
            }
            return acc;
        }, {});

        //convert to array, we dont need the keys
        const _scoreRankHistoryArray = Object.values(_scoreRankHistory);

        res.json(_scoreRankHistoryArray);
    } catch (err) {
        res.status(500).json({ error: 'Unable to get data', message: err.message });
    }
});

module.exports = router;