const express = require('express');
const moment = require('moment');
const mysql = require('mysql-await');
var apicache = require('apicache');
const { getCurrentPoll } = require('../../helpers/mappoll');
const { AltBeatmap, AltUser, AltScore, InspectorMapPollVote } = require('../../helpers/db');
const { VerifyToken } = require('../../helpers/inspector');

const router = express.Router();
let cache = apicache.middleware;

//optional user_id query
router.get('/current/:user_id?', async (req, res) => {
    try {
        let user_id = req.params.user_id;
        let data = await getCurrentPoll();

        if (data?.map_ids && data.map_ids.length > 0) {
            const maps = await AltBeatmap.findAll({
                where: {
                    beatmap_id: data.map_ids
                }
            });
            data.maps = maps;

            //check if user is set and if user has a score on the maps
            if (user_id) {
                const scores = await AltScore.findAll({
                    where: {
                        user_id: user_id,
                        beatmap_id: data.map_ids
                    }
                });
                // data.scores = scores;

                for (let i = 0; i < scores.length; i++) {
                    const score = scores[i];
                    if (score) {
                        if (!data.scores) {
                            data.scores = [];
                        }
                        data.scores.push(score.beatmap_id);
                    }
                }
            }

            //check if user is set and if user has voted on the maps
            if (user_id) {
                const vote = await InspectorMapPollVote.findOne({
                    where: {
                        user_id: user_id,
                        poll_entry_id: data.id
                    }
                });

                if (vote) {
                    data.voted = vote.beatmap_id;
                }
            }
        }
        res.json(data ?? []);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

router.post('/vote', async (req, res) => {
    try {
        const { map_id, login, token } = req.body;

        //validate user
        if (!(await VerifyToken(token, login, false))) {
            throw new Error('Invalid token');
        }

        //get current poll
        const poll = await getCurrentPoll();
        if (!poll) {
            throw new Error('No active poll');
        }

        //check if map is in poll
        if (!poll.map_ids.includes(map_id)) {
            throw new Error('Map is not in poll');
        }

        //check if user has already voted
        const vote = await InspectorMapPollVote.findOne({
            where: {
                user_id: login,
                poll_entry_id: poll.id
            }
        });
        if (vote) {
            throw new Error('User has already voted');
        }

        //create vote
        await InspectorMapPollVote.create({
            user_id: login,
            poll_entry_id: poll.id,
            beatmap_id: map_id
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
