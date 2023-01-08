const { default: axios } = require('axios');
const { Client } = require("pg");
const express = require('express');
const router = express.Router();
const crypto = require("crypto");
require('dotenv').config();
const mysql = require('mysql-await');
const rateLimit = require('express-rate-limit');

const update_Limiter = rateLimit({
    windowMs: 60 * 1000, // 15 minutes
    max: 60, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// const SESSION_LENGTH = 60 * 60 * 24 * 3;
const SESSION_DAYS = 3;

const connConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
};

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

    //check if user exists in db
    const connection = mysql.createConnection(connConfig);
    connection.on('error', (err) => {
        res.json({
            message: 'Unable to connect to database',
            error: err,
        });
    });

    //clear out old tokens
    await connection.awaitQuery(`DELETE FROM inspector_tokens WHERE date_created<subdate(current_date, ${SESSION_DAYS})`);

    //check if user exists in db
    const user = await connection.awaitQuery(`SELECT * FROM inspector_users WHERE osu_id = ${user_id}`);

    //if user doesn't exist, add them
    if (user.length == 0) {
        //add user to db
        const registerResult = await connection.awaitQuery(`
            INSERT INTO inspector_users
            (osu_id, known_username) VALUES (${user_id}, '${username}')`);

        if (registerResult.affectedRows == 0) {
            res.status(500).json({ error: 'Unable to register user' });
            await connection.end();
            return;
        }
    } else {
        //update username if it's different
        await connection.awaitQuery(`UPDATE inspector_users SET known_username = '${username}' WHERE osu_id = ${user_id}`);
    }

    //check if user already has a token
    let token = null;
    try {
        token = await crypto.randomBytes(64).toString('hex');
    } catch (e) {
        res.json({ error: 'Unable to generate token' });
        await connection.end();
        return;
    }

    if (token === null) {
        res.json({ error: 'Unable to generate token' });
        await connection.end();
        return;
    }

    //add token to db
    try {
        const tokenResult = await connection.awaitQuery(`INSERT INTO inspector_tokens (osu_id, token, date_created) VALUES (?, ?, ?)`, [user_id, token, new Date()]);
    } catch (e) {
        res.json({ error: 'Unable to save token' });
        await connection.end();
        return;
    }

    const login_data = {
        user_id: user_id,
        username: username,
        token: token,
    }

    res.json(login_data);
    // res.json(user);
    await connection.end();
});

router.post('/validate_token', async (req, res, next) => {
    const session_token = req.body.token;
    const user_id = req.body.user_id;

    if (session_token == null || user_id == null) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    const connection = mysql.createConnection(connConfig);
    connection.on('error', (err) => {
        res.json({
            message: 'Unable to connect to database',
            error: err,
        });
    });

    let result = await connection.awaitQuery(`SELECT * FROM inspector_tokens WHERE token = ? AND osu_id = ? AND date_created>subdate(current_date, ${SESSION_DAYS})`, [session_token, user_id]);
    if (result.length === 0) {
        res.json({ valid: false });
        await connection.end();
        return;
    }

    res.json({ valid: true });
    await connection.end();
});

router.post('/logout', async (req, res, next) => {
    const session_token = req.body.token;
    const user_id = req.body.user_id;

    if (session_token == null || user_id == null) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    const connection = mysql.createConnection(connConfig);
    connection.on('error', (err) => {
        res.json({
            message: 'Unable to connect to database',
            error: err,
        });
    });

    let result = await connection.awaitQuery(`
        DELETE FROM inspector_tokens 
        WHERE token = ? 
        OR (osu_id = ? AND date_created<subdate(current_date, ${SESSION_DAYS}))`, [session_token, user_id]);
    if (result.length === 0) {
        res.json({ result: false });
        await connection.end();
        return;
    }

    res.json({ result: true });
    await connection.end();
});

router.get('/get/:id', async (req, res, next) => {
    const user_id = req.params.id;

    if (user_id == null) {
        res.status(401).json({ error: 'Invalid user id' });
        return;
    }

    const connection = mysql.createConnection(connConfig);
    connection.on('error', (err) => {
        res.json({
            message: 'Unable to connect to database',
            error: err,
        });
    });

    let result = await connection.awaitQuery(`SELECT * FROM inspector_users WHERE osu_id = ?`, [user_id]);
    if (result.length === 0) {
        res.json({ valid: false });
        await connection.end();
        return;
    }

    res.json(result[0]);
    await connection.end();
});

const allowed_visitor_order_by = ['count', 'last_visit'];
router.get('/visitors/get', async (req, res, next) => {
    const order_by = req.query.order_by || 'count';
    const limit = Number(req.query.limit || 10);

    if (!allowed_visitor_order_by.includes(order_by)) {
        res.status(401).json({ error: 'Invalid order_by' });
        return;
    }

    const connection = mysql.createConnection(connConfig);
    connection.on('error', (err) => {
        res.json({
            message: 'Unable to connect to database',
            error: err,
        });
    });

    let visitor_lbs;
    try {
        visitor_lbs = await connection.awaitQuery(
            `SELECT t.* FROM 
                (
                    SELECT target_id as osu_id, sum(count) as count, roles, known_username, max(last_visit) as last_visit
                    FROM inspector_visitors 
                    LEFT JOIN inspector_users ON inspector_users.osu_id = inspector_visitors.target_id
                    GROUP BY target_id
                ) as t
            ORDER BY t.${order_by} DESC
            LIMIT ?`, [limit]);
    } catch (err) {
        res.json({
            message: 'Unable to get visitors',
            error: err,
        });
        return;
    }

    //attempt to get usernames for each user
    let user_ids = visitor_lbs.map((row) => row.osu_id);
    let data;
    try {
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();
        // const { rows } = await client.query('SELECT count(*) FROM priorityuser WHERE user_id = $1', [id]);
        const { rows } = await client.query(`SELECT user_id, username FROM users2 WHERE user_id IN (${user_ids.join(',')})`);
        // const { rows } = await client.query('SELECT count(*) FROM priorityuser');
        await client.end();
        data = rows;
    } catch (err) {
        res.json({
            message: 'Unable to get usernames',
            error: err,
        });
        return;
    }

    //merge the two arrays
    for (let i = 0; i < visitor_lbs.length; i++) {
        if (visitor_lbs[i].known_username) continue;
        for (let j = 0; j < data.length; j++) {
            if (visitor_lbs[i].osu_id == data[j].user_id) {
                visitor_lbs[i].known_username = data[j].username;
            }
        }
    }

    res.json(visitor_lbs);
    await connection.end();
});

router.get('/visitors/get/:id', async (req, res, next) => {
    const user_id = req.params.id;
    const limit = req.query.limit || 10;

    if (user_id == null) {
        res.status(401).json({ error: 'Invalid user id' });
        return;
    }

    const connection = mysql.createConnection(connConfig);
    connection.on('error', (err) => {
        res.json({
            message: 'Unable to connect to database',
            error: err,
        });
    });

    let result = await connection.awaitQuery(`
        SELECT * FROM inspector_visitors a
        LEFT JOIN inspector_users b ON a.visitor_id = b.osu_id
        WHERE target_id = ? ORDER BY last_visit DESC LIMIT ?
    `, [user_id, limit]);

    res.json(result);
    await connection.end();
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

    const connection = mysql.createConnection(connConfig);
    connection.on('error', (err) => {
        res.json({
            message: 'Unable to connect to database',
            error: err,
        });
    });

    //check if visitor already visited target
    let result = await connection.awaitQuery(`SELECT * FROM inspector_visitors WHERE (visitor_id = ?${visitor_id === null ? ' OR visitor_id IS NULL' : ''}) AND target_id = ?`, [visitor_id, target_id]);
    if (result.length > 0) {
        //update visit date
        await connection.awaitQuery(`UPDATE inspector_visitors SET last_visit = ?, count = count+1 WHERE (visitor_id = ?${visitor_id === null ? ' OR visitor_id IS NULL' : ''}) AND target_id = ?`, [new Date(), visitor_id, target_id]);
    } else {
        result = await connection.awaitQuery(`INSERT INTO inspector_visitors (visitor_id, target_id, last_visit) VALUES (?,?,?)`, [visitor_id, target_id, new Date()]);
    }

    res.json({});
    await connection.end();
});

router.post('/update_profile', update_Limiter, async (req, res, next) => {
    const user_id = req.body.user_id;
    const token = req.body.token;
    const data = req.body.data;

    console.log(data);

    if (user_id == null || token == null || data == null) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    const connection = mysql.createConnection(connConfig);
    connection.on('error', (err) => {
        res.json({
            message: 'Unable to connect to database',
            error: err,
        });
    });

    //check if token is valid
    let result = await connection.awaitQuery(`SELECT * FROM inspector_tokens WHERE token = ? AND osu_id = ? AND date_created>subdate(current_date, ${SESSION_DAYS})`, [token, user_id]);
    if (result.length === 0) {
        res.status(401).json({ error: 'Invalid token' });
        await connection.end();
        return;
    }

    //check if user exists
    result = await connection.awaitQuery(`SELECT * FROM inspector_users WHERE osu_id = ?`, [user_id]);
    if (result.length === 0) {
        res.status(401).json({ error: 'Invalid user' });
        await connection.end();
        return;
    }

    //secure data
    if (data.osu_id !== undefined) { data.osu_id = undefined; }
    if (data.id !== undefined) { data.id = undefined; }
    if (data.known_username !== undefined) { data.known_username = undefined; }
    if (data.roles !== undefined) { data.roles = undefined; }

    //update user
    await connection.awaitQuery(`UPDATE inspector_users SET ? WHERE osu_id = ?`, [data, user_id]);

    res.json({});
    await connection.end();
});

module.exports = router;