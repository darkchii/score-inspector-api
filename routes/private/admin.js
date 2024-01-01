const { default: axios } = require('axios');
const express = require('express');
const router = express.Router();
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const { InspectorUser, InspectorRole } = require('../../helpers/db');
const { VerifyToken, GetInspectorUser } = require('../../helpers/inspector');

const update_Limiter = rateLimit({
    windowMs: 60 * 1000, // 15 minutes
    max: 60, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    validate: { xForwardedForHeader: false }
});

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
                }
            ]
        });
    }catch(err){
        res.json({ error: err.message });
        return;
    }

    res.json(users);
});

module.exports = router;