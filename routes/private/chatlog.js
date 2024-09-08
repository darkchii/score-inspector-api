const { default: axios } = require('axios');
const express = require('express');
const router = express.Router();
require('dotenv').config();
const { InspectorUser, InspectorRole, InspectorOsuUser, InspectorClanMember, InspectorClan, UserMessage } = require('../../helpers/db');
const { VerifyToken, GetInspectorUser, getFullUsers } = require('../../helpers/inspector');
const { Sequelize } = require('sequelize');

router.get('/active_users', async (req, res, next) => {
    //get users with most messages
    try{
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
    }catch(err){
        res.json({error: err.message});
        return;
    }
});

router.get('/active_channels', async (req, res, next) => {
    //get channels with most messages
    try{
        const data = await UserMessage.findAll({
            attributes: ['channel', [Sequelize.fn('COUNT', Sequelize.col('channel')), 'message_count']],
            group: ['channel'],
            order: [[Sequelize.fn('COUNT', Sequelize.col('channel')), 'DESC']],
        });

        res.json(data);
    }catch(err){
        res.json({error: err.message});
        return;
    }
});

module.exports = router;