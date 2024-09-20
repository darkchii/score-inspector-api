const { default: axios } = require('axios');
var apicache = require('apicache');
const express = require('express');
const router = express.Router();
require('dotenv').config();
const { UserMessage } = require('../../helpers/db');
const { getFullUsers } = require('../../helpers/inspector');
const { Sequelize, Op } = require('sequelize');
const { GetBeatmaps } = require('../../helpers/osu');
let cache = apicache.middleware;

router.get('/active_users', cache('1 hour'), async (req, res, next) => {
    //get users with most messages
    try {
        const data = await UserMessage.findAll({
            attributes: ['user_id', [Sequelize.fn('COUNT', Sequelize.col('user_id')), 'message_count']],
            group: ['user_id'],
            where: {
                user_id: {
                    [Op.gt]: 0
                }  
            },
            order: [[Sequelize.fn('COUNT', Sequelize.col('user_id')), 'DESC']],
            limit: 25
        });

        const user_ids = data.map((user) => user.user_id);

        const users = await getFullUsers(user_ids);

        const final_data = data.map((user) => {
            const user_data = users.find((u) => u.osu?.id === user.user_id);
            return {
                user_id: user.dataValues.user_id,
                message_count: user.dataValues.message_count,
                username: user_data?.osu?.username,
                user: user_data
            };
        });

        res.json(final_data);
    } catch (err) {
        res.json({ error: err.message });
        return;
    }
});

router.get('/active_channels', cache('1 hour'), async (req, res, next) => {
    //get channels with most messages
    try {
        const data = await UserMessage.findAll({
            attributes: ['channel', [Sequelize.fn('COUNT', Sequelize.col('channel')), 'message_count']],
            group: ['channel'],
            order: [[Sequelize.fn('COUNT', Sequelize.col('channel')), 'DESC']],
        });

        res.json(data);
    } catch (err) {
        res.json({ error: err.message });
        return;
    }
});

router.get('/daily_count', cache('1 hour'), async (req, res, next) => {
    //get message count for each day (for a graph), based on "date" column
    try {
        const data = await UserMessage.findAll({
            attributes: [
                [Sequelize.fn('DATE_FORMAT', Sequelize.col('date'), '%Y-%m-%d'), 'day'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'message_count']
            ],
            group: ['day'],
            order: ['day']
        });

        res.json(data);
    } catch (err) {
        res.json({ error: err.message });
        return;
    }
});

router.get('/popular_hours', cache('1 hour'), async (req, res, next) => {
    try{
        //show cumulative message count for each hour of the day
        const data_global = await UserMessage.findAll({
            attributes: [
                [Sequelize.fn('HOUR', Sequelize.col('date')), 'hour'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'message_count']
            ],
            group: ['hour'],
            order: ['hour']
        });

        const data_today = await UserMessage.findAll({
            attributes: [
                [Sequelize.fn('HOUR', Sequelize.col('date')), 'hour'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'message_count']
            ],
            where: {
                date: {
                    [Sequelize.Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
                }
            },
            group: ['hour'],
            order: ['hour'],
            raw: true
        });

        let fixed_data_today = [];

        //fill in missing hours as null
        for (let i = 0; i < 24; i++) {
            const found = data_today.find((hour) => hour.hour === i);

            if (found) {
                fixed_data_today.push(found);
            } else {
                fixed_data_today.push({
                    hour: i,
                    message_count: null
                });
            }
        }

        res.json({
            global: data_global,
            today: fixed_data_today
        });
    }
    catch(err){
        res.json({ error: err.message });
        return;
    }
});

const MINIMUM_WORD_SIZE = 3;
router.get('/popular_words', cache('1 hour'), async (req, res, next) => {
    try{
        const data = await UserMessage.findAll({
            attributes: ['message'],
            where: {
                message_type: 'message'
            }
        });

        const messages = data.map((message) => message.message);

        const words = messages.join(' ').split(' ').filter((word) => word.length >= MINIMUM_WORD_SIZE);

        const word_count = words.reduce((acc, word) => {
            if (!acc[word]) {
                acc[word] = 0;
            }

            acc[word]++;

            return acc;
        }, {});

        const sorted = Object.entries(word_count).sort((a, b) => b[1] - a[1]);

        //return top 25
        res.json(sorted.slice(0, 50));
    }catch(err){
        res.json({ error: err.message });
        return;
    }
});

router.get('/stats', cache('1 hour'), async (req, res, next) => {
    try {
        const message_count = await UserMessage.count({
            where: {
                message_type: 'message'
            }
        });
        const message_count_today = await UserMessage.count({
            where: {
                message_type: 'message',
                date: {
                    [Sequelize.Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        });
        const unique_users = await UserMessage.count({
            distinct: true,
            col: 'user_id'
        });
        const event_count = await UserMessage.count({
            where: {
                message_type: 'event'
            }
        });

        //group by user_id to get unique users
        const banned_users = await UserMessage.count({
            distinct: true,
            col: 'username',
            where: {
                is_banned: true
            }
        });

        const events = await UserMessage.findAll({
            attributes: ['extra_data'],
            where: {
                message_type: 'event'
            }
        });

        let event_types = {};
        events.forEach((event) => {
            if(!event.extra_data){
                return;
            }
            const data = JSON.parse(event.extra_data);
            if(data.eventType){
                if(data.eventType === 'np'){
                    data.eventType = 'Now Playing';
                }
                //capitalize first letter
                data.eventType = data.eventType.charAt(0).toUpperCase() + data.eventType.slice(1);
                if(!event_types[data.eventType]){
                    event_types[data.eventType] = 0;
                }
                event_types[data.eventType]++;
            }
        });

        //remap to array
        event_types = Object.entries(event_types).map(([key, value]) => {
            return {
                event_type: key,
                count: value
            };
        });

        res.json({
            message_count,
            message_count_today,
            unique_users,
            event_count,
            event_types,
            banned_users
        });
    } catch (err) {
        res.json({ error: err.message });
        return;
    }
});

router.get('/popular_beatmaps', cache('1 hour'),  async (req, res, next) => {
    try {
        //get top 25 of most appearing beatmap_ids
        //beatmap_id is stored in a json string in extra_data (sometimes there isnt any beatmap_id, so we skip those)
        const data = await UserMessage.findAll(
            {
                attributes: ['extra_data'],
                where: {
                    message_type: 'event'
                }
            }
        );

        let beatmap_ids = data.map((message) => {
            try {
                const extra_data = JSON.parse(message.extra_data);
                return extra_data.beatmap_id;
            } catch (err) {
                return null;
            }
        }).filter((id) => id !== null);

        //remove undefined values
        beatmap_ids = beatmap_ids.filter((id) => id !== undefined);

        const beatmap_count = beatmap_ids.reduce((acc, id) => {
            if (!acc[id]) {
                acc[id] = 0;
            }

            acc[id]++;

            return acc;
        }, {});

        const sorted = Object.entries(beatmap_count).sort((a, b) => b[1] - a[1]).slice(0, 50);

        //fetch beatmap data
        const beatmaps = await GetBeatmaps(sorted.map((beatmap) => beatmap[0]));

        let final_data = sorted.map((beatmap) => {
            const beatmap_data = beatmaps?.beatmaps?.find((b) => b.id === parseInt(beatmap[0]));
            return {
                beatmap_id: beatmap[0],
                count: beatmap[1],
                beatmap: beatmap_data
            };
        });

        //remove beatmaps without data
        final_data = final_data.filter((beatmap) => beatmap.beatmap !== undefined);
        final_data = final_data.slice(0, 25);

        res.json(final_data);
    } catch (err) {
        res.json({ error: err.message });
        return;
    }
});

module.exports = router;