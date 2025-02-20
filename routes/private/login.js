const { default: axios } = require('axios');
const express = require('express');
const router = express.Router();
const crypto = require("crypto");
require('dotenv').config();
const { InspectorUser, InspectorVisitor, AltUser, InspectorUserAccessToken, Databases, CheckConnection } = require('../../helpers/db');
const { VerifyToken, GetInspectorUser, getFullUsers, GetToken } = require('../../helpers/inspector');
const { OSU_CLIENT_ID, OSU_CLIENT_SECRET, GetOsuUsers } = require('../../helpers/osu');
const { default: Sequelize } = require('@sequelize/core');

router.post('/', async (req, res, next) => {
    let authResponse = null;
    const auth_code = req.body.code;
    const redirect = req.body.redirect;

    try {
        authResponse = await axios.post('https://osu.ppy.sh/oauth/token', {
            client_id: OSU_CLIENT_ID,
            client_secret: OSU_CLIENT_SECRET,
            code: auth_code,
            grant_type: 'authorization_code',
            redirect_uri: redirect
        }, {
            headers: {
                "Accept-Encoding": "gzip,deflate,compress"
            }
        });
    } catch (err) {
        console.error(err);
        res.status(401).json({ error: 'Unable to authorize' });
        return;
    }

    const access_token = authResponse.data.access_token;
    const refresh_token = authResponse.data.refresh_token;
    const expires_in = authResponse.data.expires_in;

    //get own data

    let userResponse = null;
    try {
        userResponse = await axios.get('https://osu.ppy.sh/api/v2/me', {
            headers: {
                "Accept-Encoding": "gzip,deflate,compress",
                "Authorization": `Bearer ${access_token}`
            }
        });
    } catch (err) {
        res.status(401).json({ error: 'Unable to get user data' });
        return;
    }

    const user_id = userResponse.data.id;
    const username = userResponse.data.username;

    if (user_id == null || username == null) {
        res.status(401).json({ error: 'Unable to get user data' });
        return;
    }

    // //check if user exists in db
    let user = await InspectorUser.findOne({ where: { osu_id: user_id } });

    //if user doesn't exist, add them
    if (user === null) {
        //add user to db
        const registeredUser = await InspectorUser.create({ osu_id: user_id, known_username: username });

        if (registeredUser instanceof InspectorUser) {
            res.status(500).json({ error: 'Unable to register user' });
            return;
        }

        user = registeredUser;
    } else {
        //update username if it's different
        await InspectorUser.update({ known_username: username }, { where: { osu_id: user_id } });
    }


    //remove old token entry if it exists
    await InspectorUserAccessToken.destroy({ where: { osu_id: user_id } });

    //add new token entry
    await InspectorUserAccessToken.create(
        {
            user_id: user.id,
            osu_id: user_id,
            access_token: access_token,
            refresh_token: refresh_token,
            expires_in: expires_in,
            created_at: new Date(),
        });

    const login_data = {
        user_id: user_id,
        username: username,
        token: access_token,
    }

    res.json(login_data);
});

router.post('/validate_token', async (req, res, next) => {
    const session_token = req.body.token;
    const user_id = req.body.user_id;

    if (session_token == null || user_id == null) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    let result = false;
    let error = "";

    try {
        result = await VerifyToken(session_token, user_id, true);
    } catch (err) {
        error = err.message;
    }

    let data;
    if (error === "") {
        try {
            data = await GetToken(user_id);
        } catch (err) {
        }
    }

    res.json({ valid: result !== false, error: error, data: data });
});

router.post('/logout', async (req, res, next) => {
    const session_token = req.body.token;
    const user_id = req.body.user_id;

    if (session_token == null || user_id == null) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    InspectorUserAccessToken.destroy({ where: { osu_id: user_id } });
    res.json({ result: true });
});

router.get('/get/:id', async (req, res, next) => {
    const user_id = req.params.id;
    //const user = await InspectorUser.findOne({ where: { osu_id: user_id } });
    const user = await GetInspectorUser(user_id);
    res.json(user);
});

const allowed_visitor_order_by = ['count', 'last_visit'];
router.get('/visitors/get', async (req, res, next) => {
    try {
        await CheckConnection(Databases.osuAlt);

        const order_by = req.query.order_by || 'count';
        const limit = Number(req.query.limit || 10);

        if (!allowed_visitor_order_by.includes(order_by)) {
            res.status(401).json({ error: 'Invalid order_by' });
            return;
        }

        let visitor_lbs = await InspectorVisitor.findAll({
            attributes: [
                'target_id',
                [Sequelize.fn('sum', Sequelize.col('count')), 'count'],
                [Sequelize.fn('max', Sequelize.col('last_visit')), 'last_visit'],
            ],
            group: ['target_id'],
            order: [[Sequelize.literal(order_by), 'DESC']],
            limit: limit,
            // include: [{
            //     model: InspectorUser,
            //     as: 'target_user',
            //     required: false,
            //     include: [{
            //         model: InspectorRole,
            //         through: { attributes: [] },
            //         as: 'roles',
            //         required: false,
            //     }]
            // }],
            raw: true,
        });

        //get inspector users
        for await (const visitor of visitor_lbs) {
            visitor.target_user = await GetInspectorUser(visitor.target_id);
        }
        // //attempt to get usernames for each user
        let user_ids = visitor_lbs.map((row) => row.target_id);
        let data;
        try {
            const rows = await AltUser.findAll({ attributes: ['user_id', 'username'], where: { user_id: user_ids, }, raw: true, });
            data = rows;
        } catch (err) {
            res.json({
                message: 'Unable to get usernames',
                error: err,
            });
            return;
        }

        // // //merge the two arrays
        for (let i = 0; i < visitor_lbs.length; i++) {
            if (visitor_lbs[i].target_user == null) {
                visitor_lbs[i].target_user = {}
            };

            for (let j = 0; j < data.length; j++) {
                if (visitor_lbs[i].target_id == data[j].user_id) {
                    visitor_lbs[i].target_user.osu_id = data[j].user_id;
                    visitor_lbs[i].target_user.known_username = data[j].username;
                }
            }
        }
        res.json(visitor_lbs);
    } catch (err) {
        res.json({
            message: 'Unable to get visitor data at this time',
            error: err,
        });
    }
});

router.all('/visitors/get/:id', async (req, res, next) => {
    const user_id = req.params.id;
    let limit = req.query.limit || 10;
    const check_visitor = req.query.check_visitor || false;

    if (user_id == null) {
        res.status(401).json({ error: 'Invalid user id' });
        return;
    }
    let result = null;
    if (!check_visitor) {
        result = await InspectorVisitor.findAll({
            where: { target_id: user_id },
            order: [['last_visit', 'DESC']],
            limit: limit,
            include: [{
                model: InspectorUser,
                as: 'visitor_user',
                required: false
            }],
            raw: true,
            nest: true
        });
    } else {
        // check for login token
        const token = req.body.token;

        if (token == null || !(await VerifyToken(token, user_id, true))) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        result = await InspectorVisitor.findAll({
            where: { visitor_id: user_id },
            order: [['last_visit', 'DESC']],
            raw: true,
            nest: true
        });

        //split into arrays of 50 ids
        let target_ids = result.map((row) => row.target_id);
        let target_id_chunks = [];
        while (target_ids.length > 0) {
            target_id_chunks.push(target_ids.splice(0, 50));
        }

        //get users for each chunk
        let users = [];
        for await (const chunk of target_id_chunks) {
            let user_chunk = await GetOsuUsers(chunk);
            users = users.concat(user_chunk);
        }

        //for each user, add the inspector user object if it exists
        for await (let user of users) {
            let inspector_user = await InspectorUser.findOne({
                where: { osu_id: user.id }
            });
            if (inspector_user != null) {
                user.inspector_user = inspector_user;
            } else {
                //generate a new inspector user
                user.inspector_user = {
                    id: null,
                    osu_id: user.id,
                    known_username: user.username,
                    roles: []
                }
            }
        }

        //add correct user to each result
        for (let row of result) {
            for (const user of users) {
                if (row.target_id == user.id) {
                    row.target_user = user;
                }
            }
        }
    }

    res.json(result);
});

router.post('/update_visitor', async (req, res, next) => {
    let visitor_id = req.body.visitor;
    let target_id = req.body.target;
    let token = req.body.token;

    //if visitor or target are strings, convert to numbers
    if (visitor_id !== null) visitor_id = Number(visitor_id);
    if (target_id !== null) target_id = Number(target_id);

    //if nan, set to null
    if (isNaN(visitor_id)) visitor_id = null;
    if (isNaN(target_id)) target_id = null;

    if ((visitor_id !== null && isNaN(visitor_id)) || isNaN(target_id)) {
        res.status(401).json({ error: 'Invalid visitor or target ID' });
        return;
    }

    if (visitor_id !== null && Number(visitor_id) === Number(target_id)) {
        res.json({ error: 'Visitor is same as target. Ignoring.' });
        return;
    }

    if (target_id == null) {
        res.status(401).json({ error: 'Invalid target ID' });
        return;
    }

    //check if visitor_id is valid
    if (visitor_id !== null) {
        let user = await InspectorUser.findOne({ where: { osu_id: visitor_id } });
        if (user == null) {
            res.status(401).json({ error: 'Invalid visitor ID' });
            return;
        }

        if (user.is_banned) {
            res.status(401).json({ error: 'Visitor is banned' });
            return;
        }

        //check if token is valid
        try {
            if (!(await VerifyToken(token, visitor_id))) {
                res.status(401).json({ error: 'Invalid token' });
                return;
            }
        } catch (err) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
    }

    //check if visitor already visited target
    let result = await InspectorVisitor.findAll({
        where: {
            visitor_id: visitor_id,
            target_id: target_id,
        },
        raw: true,
        nest: true
    });
    if (result.length > 0) {
        //check time since last visit
        let last_visit = new Date(result[0].last_visit);
        let now = new Date();
        let diff = now - last_visit;
        //update visit date
        await InspectorVisitor.update({
            last_visit: Sequelize.literal('CURRENT_TIMESTAMP'),
            count: Sequelize.literal(`IF(${diff} > 600000, count + 1, count)`)
        },
            {
                where: {
                    visitor_id: visitor_id,
                    target_id: target_id,
                }
            });

    } else {
        result = await InspectorVisitor.create({ visitor_id: visitor_id, target_id: target_id, last_visit: new Date(), count: 1 });
    }

    res.json({});
});

router.post('/update_profile', async (req, res, next) => {
    const user_id = req.body.user_id;
    const token = req.body.token;
    const data = req.body.data;

    if (user_id == null || token == null || data == null) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    //check if token is valid
    let result = await VerifyToken(token, user_id);
    if (!result) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    //check if user exists
    result = await InspectorUser.findOne({ where: { osu_id: user_id }, raw: true });
    if (result.length === 0) {
        res.status(401).json({ error: 'Invalid user' });
        return;
    }

    //secure data
    if (data.osu_id !== undefined) { data.osu_id = undefined; }
    if (data.id !== undefined) { data.id = undefined; }
    if (data.known_username !== undefined) { data.known_username = undefined; }
    if (data.roles !== undefined) { data.roles = undefined; }

    const validate = (key, value, max_length, is_url = false) => {
        //check for max length
        if (value.length > max_length) {
            res.status(401).json({ error: `${key} is too long: ${value}` });
            return false;
        }

        //check for invalid characters (unicode)
        if (!/^[\x00-\x7F]*$/.test(value)) {
            res.status(401).json({ error: `Invalid characters in ${key}` });
            return false;
        }

        //check for invalid characters (special, if not url)
        if (!/^[\w\s]*$/.test(value) && !is_url) {
            // res.json({ error: `Invalid characters in ${key}` });
            res.status(401).json({ error: `Invalid characters in ${key}` });
            return false;
        }

        return true;
    }

    if (!validate('background_image', data.background_image, 255, true)) return;

    //update user
    await InspectorUser.update(data, { where: { osu_id: user_id } });

    res.json({});
});

module.exports = router;
