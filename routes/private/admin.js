const { default: axios } = require('axios');
const express = require('express');
const router = express.Router();
require('dotenv').config();
const { InspectorUser, InspectorRole, InspectorOsuUser, InspectorClanMember, InspectorClan } = require('../../helpers/db');
const { VerifyToken, GetInspectorUser } = require('../../helpers/inspector');
const { orderBy } = require('lodash');

async function HasAdminAccess(user_id, session_token) {
    if (session_token == null || user_id == null) {
        throw new Error('Invalid data');
    }

    const valid_token = await VerifyToken(session_token, user_id);

    if (!valid_token) {
        throw new Error('Invalid token');
    }

    const user = await GetInspectorUser(user_id);

    if (user == null) {
        throw new Error('Invalid user');
    }

    //check if any of the roles are admin
    const admin_roles = user.roles.filter((role) => role.is_admin === true);

    if (admin_roles.length === 0) {
        throw new Error('No permission');
    }

    return true;
}

router.post('/validate', async (req, res, next) => {
    let has_admin;
    try {
        has_admin = await HasAdminAccess(req.body.user_id, req.body.session_token);
    } catch (err) {
        res.json({ error: err.message });
        return;
    }

    res.json({
        has_admin: has_admin,
    });
});

router.post('/get_users', async (req, res, next) => {
    let has_permission = false;
    try {
        has_permission = await HasAdminAccess(req.body.user_id, req.body.session_token);
    } catch (err) {
        res.json({ error: err.message });
        return;
    }

    if (!has_permission) {
        res.json({ error: 'No permission' });
        return;
    }

    let users = null;
    try{
        users = await InspectorUser.findAll({
            include: [
                {
                    model: InspectorRole,
                    attributes: ['id', 'title', 'description', 'color', 'icon', 'is_visible', 'is_admin', 'is_listed'],
                    through: { attributes: [] },
                    as: 'roles'
                },
                {
                    model: InspectorOsuUser,
                    attributes: ['user_id', 'username', 'pp', 'global_rank'],
                    as: 'osu_user'
                },
                {
                    model: InspectorClanMember,
                    attributes: ['osu_id', 'clan_id', 'join_date', 'pending'],
                    as: 'clan_member',
                    include: [{
                        model: InspectorClan,
                        attributes: ['id', 'name', 'tag', 'color', 'creation_date', 'description', 'owner'],
                        as: 'clan',
                    }]
                }
            ],
            //order by pp desc
            order: [[{model: InspectorOsuUser, as: 'osu_user'}, 'pp', 'DESC']]
        });
    }catch(err){
        res.json({ error: err.message });
        return;
    }

    res.json(users);
});

module.exports = router;