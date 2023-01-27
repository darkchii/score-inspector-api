const { default: axios } = require('axios');
const express = require('express');
const router = express.Router();
const crypto = require("crypto");
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const { InspectorUser, InspectorComment, InspectorToken, Raw, InspectorVisitor, AltUser } = require('../helpers/db');
const { Sequelize, Op } = require('sequelize');
const { VerifyToken } = require('../helpers/inspector');

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
            client_id: dev_mode ? process.env.OSU_CLIENT_ID_DEV : process.env.OSU_CLIENT_ID,
            client_secret: dev_mode ? process.env.OSU_CLIENT_SECRET_DEV : process.env.OSU_CLIENT_SECRET,
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
        res.status(401).json({ error: 'Unable to get user data' });
        return;
    }

    const user_id = userResponse.data.id;
    const username = userResponse.data.username;

    if (user_id == null || username == null) {
        res.status(401).json({ error: 'Unable to get user data' });
        return;
    }

    //clear out old tokens
    InspectorToken.destroy({ where: { date_created: { [Op.lt]: Sequelize.literal(`SUBDATE(CURRENT_TIMESTAMP, ${SESSION_DAYS})`) } } });

    //check if user exists in db
    const user = await InspectorUser.findOne({ where: { osu_id: user_id } });

    //if user doesn't exist, add them
    if (user.length == 0) {
        //add user to db
        const [registeredUser, created] = await InspectorUser.create({ osu_id: user_id, known_username: username });

        if (!created) {
            res.status(500).json({ error: 'Unable to register user' });
            await connection.end();
            return;
        }
    } else {
        //update username if it's different
        await InspectorUser.update({ known_username: username }, { where: { osu_id: user_id } });
    }

    //check if user already has a token
    let token = null;
    try {
        token = await crypto.randomBytes(64).toString('hex');
    } catch (e) {
        res.json({ error: 'Unable to generate token' });
        return;
    }

    if (token === null) {
        res.json({ error: 'Unable to generate token' });
        return;
    }

    //add token to db
    try {
        InspectorToken.create({ osu_id: user_id, token: token, date_created: new Date() });
    } catch (e) {
        res.json({ error: 'Unable to save token' });
        return;
    }

    const login_data = {
        user_id: user_id,
        username: username,
        token: token,
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

    const result = await VerifyToken(session_token, user_id);
    res.json({ valid: result != null });
});

router.post('/logout', async (req, res, next) => {
    const session_token = req.body.token;
    const user_id = req.body.user_id;

    if (session_token == null || user_id == null) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    InspectorToken.destroy({
        where: {
            [Op.or]: [
                { token: session_token },
                { osu_id: user_id, date_created: { [Op.lt]: Sequelize.literal(`SUBDATE(CURRENT_TIMESTAMP, ${SESSION_DAYS})`) } }
            ]
        }
    });
    res.json({ result: true });
});

router.get('/get/:id', async (req, res, next) => {
    const user_id = req.params.id;
    const user = await InspectorUser.findOne({ where: { osu_id: user_id } });
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
        include: [{
            model: InspectorUser,
            as: 'target_user',
            required: false,
        }],
        raw: true,
        nest: true
    });

    //attempt to get usernames for each user
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

    // //merge the two arrays
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

router.get('/visitors/get/:id', async (req, res, next) => {
    const user_id = req.params.id;
    const limit = req.query.limit || 10;

    if (user_id == null) {
        res.status(401).json({ error: 'Invalid user id' });
        return;
    }

    let result = await InspectorVisitor.findAll({
        where: { target_id: user_id },
        order: [['last_visit', 'DESC']],
        limit: limit,
        include: [{
            model: InspectorUser,
            as: 'visitor_user',
            required: false,
        }],
        raw: true,
        nest: true
    });

    res.json(result);
});

router.post('/update_visitor', update_Limiter, async (req, res, next) => {
    const visitor_id = req.body.visitor;
    const target_id = req.body.target;

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
            [Op.or]: [
                { visitor_id: visitor_id },
                { visitor_id: null },
            ],
            target_id: target_id,
        },
        raw: true,
        nest: true
    });
    if (result.length > 0) {
        //update visit date
        await InspectorVisitor.update({
                last_visit: Sequelize.literal('CURRENT_TIMESTAMP'),
                count: Sequelize.literal('count + 1')
            },
            {
                where: {
                    [Op.or]: [{ visitor_id: visitor_id }, { visitor_id: null },],
                    target_id: target_id,
                }
            });
    } else {
        result = await InspectorVisitor.create({ visitor_id: visitor_id, target_id: target_id, last_visit: new Date() });
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
    let result = await InspectorToken.findAll({
        where: {
            token: token,
            osu_id: user_id,
            date_created: {
                [Op.gt]: Sequelize.literal(`subdate(current_date, ${SESSION_DAYS})`)
            }
        },
        raw: true,
        nest: true
    });
    if (result.length === 0) {
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

    if(!(await VerifyToken(token, sender))) {
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