const express = require('express');
var apicache = require('apicache');
const { InspectorOsuUser, InspectorCompletionist, GetHistoricalScoreRankModel, InspectorScoreStat, OsuTeam, OsuTeamMember, OsuTeamRuleset } = require('../../helpers/db');
const { MODE_SLUGS, GetBeatmap, GetBeatmapAttributes, GetUserBeatmapScores, GetOsuUserScores, GetBeatmapStrains } = require('../../helpers/osu');
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
        let where = country ? { country_code: country } : {};
        let users = await InspectorOsuUser.findAll({
            where: where,
            order: [[Sequelize.literal(RANK_STATS[statIndex].order), RANK_STATS[statIndex].dir]],
            limit: RANK_PAGE_SIZE,
            offset: (page - 1) * RANK_PAGE_SIZE
        });

        users = JSON.parse(JSON.stringify(users));
        const total_count = await InspectorOsuUser.count({
            where: where
        });

        //get teams
        const ids = users.map(user => user.user_id);
        const teams = await OsuTeamMember.findAll({
            where: {
                user_id: ids
            },
            include: [{
                model: OsuTeam,
                required: true,
                where: {
                    deleted: false
                },
            }]
        });

        //map teams to users
        const teamsMap = teams.reduce((acc, team) => {
            if (!acc[team.user_id]) {
                acc[team.user_id] = team.team;
            }
            return acc;
        }, {});

        users.forEach(user => {
            user.team = teamsMap[user.user_id] || null;
        });

        //pass the total count through headers
        res.setHeader('X-Total-Count', total_count);
        res.setHeader('X-Page', page);
        res.setHeader('X-Page-Size', RANK_PAGE_SIZE);
        res.setHeader('X-Total-Pages', Math.ceil(total_count / RANK_PAGE_SIZE));

        //access-control-expose-headers
        res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Page-Size, X-Total-Pages');
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

        if (beatmap_count_cache == -1 || (new Date() - beatmap_count_cache_last_updated) > 3600000) {
            const c = await InspectorScoreStat.findOne({
                where: {
                    key: 'system_info'
                }
            })
            const _c = JSON.parse(c?.value);
            beatmap_count_cache = _c?.beatmap_count ?? 120000; //placeholder value, extremely inaccurate
            beatmap_count_cache_last_updated = new Date();
        }

        const [user, team, scoreRankHistory, top50sData, currentScoreRank, completion, scoresPinned, scoresBest, scoresRecent] = await Promise.allSettled([
            mode == 0 ? InspectorOsuUser.findOne({ where: { user_id: id }, raw: true }) : null,
            OsuTeamMember.findOne({
                where: { user_id: id },
                include: [{
                    model: OsuTeam,
                    required: true,
                    include: [{
                        model: OsuTeamRuleset,
                        required: false
                    }],
                    where: {
                        deleted: false
                    }
                }]
            }),
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
            team: team?.value?.team ?? null,
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
        console.error(err);
        res.status(500).json({ error: 'Unable to get user', message: err.message });
    }
});

let coe_attendees_cache = {
    data: [],
    expires: null
};

router.get('/coe/:id', cache('1 hour'), async (req, res) => {
    try {
        let coe_attendees = [];

        if (coe_attendees_cache.expires && coe_attendees_cache.expires > new Date()) {
            coe_attendees = coe_attendees_cache.data;
        } else {
            const _data = await axios.get('https://cavoe.events/api/events/3/attendees');
            coe_attendees = _data.data?.attendees;

            coe_attendees_cache = {
                data: coe_attendees,
                //cache for 1 hour
                expires: new Date(new Date().getTime() + 3600000)
            };
        }

        let user = coe_attendees.find(u => u.user.osuUser?.id == req.params.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        if(!user.user.roles){
            user.user.roles = [];
        }

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Unable to get data', message: err.message });
    }
});

router.post('/score_rank_history/:mode', async (req, res) => {
    try {
        const mode = req.params.mode;
        const ids = req.body.ids;

        //for each ID, get the oldest date, max 35 days old
        const scoreRankHistory = await GetHistoricalScoreRankModel(MODE_SLUGS[mode]).findAll({
            where: {
                [Op.and]: [
                    { osu_id: ids },
                    { date: { [Op.gte]: new Date(new Date() - 31 * 24 * 60 * 60 * 1000) } }
                ]
            },
            order: [
                ['date', 'ASC']
            ],
        });

        console.log(`Found ${scoreRankHistory.length} score rank history entries`);

        //for each user, get the oldest entry
        let _scoreRankHistory = {};
        scoreRankHistory.forEach(entry => {
            if (!_scoreRankHistory[entry.osu_id]) {
                _scoreRankHistory[entry.osu_id] = entry;
            } else {
                if (entry.date < _scoreRankHistory[entry.osu_id].date) {
                    _scoreRankHistory[entry.osu_id] = entry;
                }
            }
        });

        //convert to array, we dont need the keys
        const _scoreRankHistoryArray = Object.values(_scoreRankHistory);

        res.json(_scoreRankHistoryArray);
    } catch (err) {
        res.status(500).json({ error: 'Unable to get data', message: err.message });
    }
});

router.all('/difficulty/:id/:ruleset', async (req, res) => {
    //gets beatmap data, and difficulty data if mods are provided
    const beatmap_id = req.params.id;
    const mods = req.body.mods || null;
    const ruleset = req.params.ruleset || 0;

    try {
        const attributes = await GetBeatmapAttributes(beatmap_id, mods, ruleset);

        res.json({
            beatmap_id: beatmap_id,
            mods: mods,
            ruleset: ruleset,
            attributes: attributes,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Unable to get beatmap', message: err.message });
    }
});

router.all('/strains/:id/:ruleset', async (req, res) => {
    //gets beatmap data, and difficulty data if mods are provided
    const beatmap_id = req.params.id;
    const mods = req.body.mods || null;
    const ruleset = req.params.ruleset || 0;

    try {
        const strains = await GetBeatmapStrains(beatmap_id, mods, ruleset);

        res.json({
            beatmap_id: beatmap_id,
            mods: mods,
            ruleset: ruleset,
            strains: strains,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Unable to get beatmap', message: err.message });
    }
});

router.get('/scores/:beatmap_id/:user_id/:ruleset', async (req, res) => {
    const beatmap_id = req.params.beatmap_id;
    const user_id = req.params.user_id;
    const ruleset = req.params.ruleset || 'osu';
    const ruleset_id = MODE_SLUGS.findIndex(r => r == ruleset);

    try {
        const scores = await GetUserBeatmapScores(user_id, beatmap_id, ruleset);
        const beatmap = await GetBeatmap(beatmap_id, ruleset);
        const attributes = await GetBeatmapAttributes(beatmap_id, null, ruleset_id);

        if (!scores || scores.length === 0) {
            res.status(404).json({ error: 'No scores found' });
            return;
        }

        if (!beatmap) {
            res.status(404).json({ error: 'Beatmap not found' });
            return;
        }

        if (!attributes) {
            res.status(404).json({ error: 'Beatmap attributes not found' });
            return;
        }

        res.json({
            beatmap: beatmap,
            attributes: attributes,
            scores: scores?.scores,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Unable to get scores', message: err.message });
    }
});

//get all teams for given user IDs
router.post('/users/teams', async (req, res) => {
    let ids = req.body.ids;
    if (ids && ids.length > 0) {
        //filter non-numbers
        ids = ids.filter(id => !isNaN(id));
    }
    if (!ids || ids.length === 0) {
        res.status(400).json({ error: 'No IDs provided' });
        return;
    }

    try {
        const teams = await OsuTeamMember.findAll({
            where: {
                user_id: ids
            },
            include: [{
                model: OsuTeam,
                required: true,
                where: {
                    deleted: false
                },
            }]
        });

        res.json(teams);
    } catch (err) {
        res.status(500).json({ error: 'Unable to get teams', message: err.message });
    }
});

module.exports = router;