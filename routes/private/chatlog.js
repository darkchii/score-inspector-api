const { default: axios } = require('axios');
const express = require('express');
const router = express.Router();
require('dotenv').config();
const { InspectorUser, InspectorRole, InspectorOsuUser, InspectorClanMember, InspectorClan, UserMessage, AltBeatmap } = require('../../helpers/db');
const { VerifyToken, GetInspectorUser, getFullUsers } = require('../../helpers/inspector');
const { Sequelize } = require('sequelize');

router.get('/active_users', async (req, res, next) => {
    //get users with most messages
    try {
        const data = await UserMessage.findAll({
            attributes: ['user_id', [Sequelize.fn('COUNT', Sequelize.col('user_id')), 'message_count']],
            group: ['user_id'],
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

router.get('/active_channels', async (req, res, next) => {
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

router.get('/hourly_count', async (req, res, next) => {
    //get message count for each hour (for a graph), based on "date" column
    try {
        const data = await UserMessage.findAll({
            attributes: [
                [Sequelize.fn('DATE_FORMAT', Sequelize.col('date'), '%Y-%m-%d %H:00:00'), 'hour'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'message_count']
            ],
            group: ['hour'],
            order: ['hour']
        });

        res.json(data);
    } catch (err) {
        res.json({ error: err.message });
        return;
    }
});

const MINIMUM_WORD_SIZE = 3;
router.get('/popular_words', async (req, res, next) => {
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

router.get('/stats', async (req, res, next) => {
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

        res.json({
            message_count,
            message_count_today,
            unique_users,
            event_count
        });
    } catch (err) {
        res.json({ error: err.message });
        return;
    }
});

module.exports = router;