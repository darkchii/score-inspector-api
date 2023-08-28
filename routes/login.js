const { default: axios } = require('axios');
const express = require('express');
const router = express.Router();
const crypto = require("crypto");
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const { InspectorUser, InspectorComment, InspectorToken, Raw, InspectorVisitor, AltUser, Databases, InspectorRole, InspectorUserAccessToken, InspectorUserFriend } = require('../helpers/db');
const { Sequelize, Op } = require('sequelize');
const { VerifyToken, GetInspectorUser, InspectorRefreshFriends, getFullUsers } = require('../helpers/inspector');
const { GetUsers, OSU_CLIENT_ID, OSU_CLIENT_SECRET, GetOsuUsers } = require('../helpers/osu');

const update_Limiter = rateLimit({
    windowMs: 60 * 1000, // 15 minutes
    max: 60, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// const SESSION_LENGTH = 60 * 60 * 24 * 3;
const SESSION_DAYS = 3;

router.post('/', async (req, res, next) => {
    let authResponse = null;
    const auth_code = req.body.code;
    const dev_mode = req.body.is_dev;
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
        console.error(err);
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
        const [registeredUser, created] = await InspectorUser.create({ osu_id: user_id, known_username: username });

        if (!created) {
            res.status(500).json({ error: 'Unable to register user' });
            await connection.end();
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

    try {
        await InspectorRefreshFriends(access_token, user_id);
    } catch (err) {
        console.error(err);
    }

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

    try{
        result = await VerifyToken(session_token, user_id, true);
    }catch(err){
        error = err.message;
    }
    
    res.json({ valid: result !== false, error: error });
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
            console.log('created target_user for ' + visitor_lbs[i].target_id);
        };

        for (let j = 0; j < data.length; j++) {
            if (visitor_lbs[i].target_id == data[j].user_id) {
                visitor_lbs[i].target_user.osu_id = data[j].user_id;
                visitor_lbs[i].target_user.known_username = data[j].username;
            }
        }
    }
    res.json(visitor_lbs);
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
            let inspector_user = await InspectorUser.findOne({ where: { osu_id: user.id } });
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

router.get('/friends/:id', async (req, res, next) => {
    //check if user exists and allows public friends listing
    const user_id = req.params.id;
    const user = await InspectorUser.findOne({ where: { osu_id: user_id } });

    if (user == null) {
        res.status(401).json({ error: 'Invalid user' });
        return;
    }

    if (!user.is_friends_public) {
        res.status(401).json({ error: 'Friends list is private' });
        return;
    }

    //get friends
    const friends = (await InspectorUserFriend.findAll({
        attributes: ['friend_osu_id'],
        where: { primary_osu_id: user_id },
        raw: true,
        nest: true
    }))?.map((row) => row.friend_osu_id);

    let full_users = [];
    if (friends.length > 0) {
        full_users = await getFullUsers(friends, { daily: true, alt: true, score: true });
    }

    res.json(full_users);
});

router.post('/friends/refresh', async (req, res, next) => {
    const user_id = req.body.user_id;
    const token = req.body.token;

    //refresh friends
    try{
        await InspectorRefreshFriends(token, user_id);
    }catch(err){
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    res.json({});
});

router.post('/update_visitor', update_Limiter, async (req, res, next) => {
    let visitor_id = req.body.visitor;
    let target_id = req.body.target;

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
        //update visit date
        console.log(await InspectorVisitor.update({
            last_visit: Sequelize.literal('CURRENT_TIMESTAMP'),
            count: Sequelize.literal('count + 1')
        },
            {
                where: {
                    visitor_id: visitor_id,
                    target_id: target_id,
                }
            }));

    } else {
        result = await InspectorVisitor.create({ visitor_id: visitor_id, target_id: target_id, last_visit: new Date(), count: 1 });
    }

    res.json({});
});

router.post('/update_profile', update_Limiter, async (req, res, next) => {
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

    //update user
    await InspectorUser.update(data, { where: { osu_id: user_id } });

    res.json({});
});

router.post('/comments/send', async (req, res, next) => {
    const token = req.body.token;
    const sender = req.body.sender;
    const recipient = req.body.recipient;
    const comment = req.body.comment;
    const reply_to = req.body.reply_to || -1;

    if (sender == null || recipient == null || token == null || comment == null) {
        res.status(401).json({ error: 'Invalid data' });
        return;
    }

    if (!(await VerifyToken(token, sender))) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    // create comment
    try {
        // await connection.awaitQuery(`INSERT INTO inspector_comments (commentor_id, target_id, date_created, reply_to, comment) VALUES (?,?,?,?,?)`, [sender, recipient, new Date(), reply_to, comment]);
        await InspectorComment.create({ commentor_id: sender, target_id: recipient, date_created: Sequelize.literal('CURRENT_TIMESTAMP'), reply_to: reply_to, comment: comment });
    } catch (err) {
        res.status(401).json({ error: 'Unknown failure' });
        return;
    }

    res.json({});
});

router.get('/comments/get/:id', async (req, res, next) => {
    const user_id = req.params.id;

    if (user_id == null) {
        res.status(401).json({ error: 'Invalid user ID' });
        return;
    }

    const comments = await InspectorComment.findAll({
        logging: console.log,
        where: { target_id: user_id },
        include: [{
            model: InspectorUser,
            as: 'commentor',
            required: true,
        }],
        order: [
            ['date_created', 'DESC'],
        ],
    });
    res.json(comments);
});

router.post('/comments/delete', async (req, res, next) => {
    const id = req.body.comment_id;
    const token = req.body.token;
    const user_id = req.body.deleter_id;

    if (user_id == null || token == null || id == null) {
        res.status(401).json({ error: 'Invalid data' });
        return;
    }

    //check if token is valid
    if (!(await VerifyToken(token, user_id))) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    const data = InspectorComment.destroy({
        where: {
            id: id,
            commentor_id: user_id,
        }
    });
    res.json({});
});

module.exports = router;