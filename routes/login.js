const { default: axios } = require('axios');
const express = require('express');
const router = express.Router();
const crypto = require("crypto");
require('dotenv').config();
const mysql = require('mysql-await');
// const SESSION_LENGTH = 60 * 60 * 24 * 3;
const SESSION_DAYS = 3;

const connConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
};

router.post('/', async (req, res) => {
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

router.post('/validate_token', async (req, res) => {
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

router.post('/logout', async (req, res) => {
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

router.get('/get/:id', async (req, res) => {
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

router.get('/visitors/:id', async (req, res) => {
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

router.post('/update_visitor', async (req, res) => {
    const visitor_id = req.body.visitor;
    const target_id = req.body.target;

    if((visitor_id!==null && isNaN(visitor_id)) || isNaN(target_id)) {
        res.status(401).json({ error: 'Invalid visitor or target ID' });
        return;
    }

    if(visitor_id!==null && Number(visitor_id) === Number(target_id)) {
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

module.exports = router;