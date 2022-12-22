const { Client } = require("pg");
require('dotenv').config();

module.exports.IsRegistered = IsRegistered;
async function IsRegistered(id) {
    let data;
    try {
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();
        const { rows } = await client.query('SELECT count(*) FROM priorityuser WHERE user_id = $1', [id]);
        // const { rows } = await client.query('SELECT count(*) FROM priorityuser');
        await client.end();
        data = { registered: rows[0].count > 0 };
    } catch (err) {
        throw new Error('Something went wrong, please try later...');
    }
    return data;
}

module.exports.GetAllUsers = GetAllUsers;
async function GetAllUsers() {
    let data;
    try {
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();
        const { rows } = await client.query('SELECT priorityuser.user_id, users2.username FROM priorityuser LEFT JOIN users2 ON priorityuser.user_id = users2.user_id WHERE username IS NOT NULL');
        await client.end();
        data = rows;
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}

module.exports.GetUser = GetUser;
async function GetUser(id) {
    let data;
    try {
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();
        const { rows } = await client.query(`SELECT * FROM users2 WHERE user_id=$1`, [id]);
        await client.end();
        data = rows;
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}

module.exports.FindUser = FindUser;
async function FindUser(query, single) {
    let data;
    try {
        const client = new Client({ user: process.env.ALT_DB_USER, host: process.env.ALT_DB_HOST, database: process.env.ALT_DB_DATABASE, password: process.env.ALT_DB_PASSWORD, port: process.env.ALT_DB_PORT });
        await client.connect();
        let _where = ``;
        if (single) {
            _where = `WHERE users2.user_id::text = $1 OR (LOWER(username) = LOWER($2))`;
        } else {
            _where = `WHERE users2.user_id::text = $1 OR (LOWER(username) SIMILAR TO LOWER($2))`;
        }
        const { rows } = await client.query(`
          SELECT ${single ? `*` : `priorityuser.user_id as user_id, users2.username, users2.country_code`} FROM priorityuser 
          LEFT JOIN users2 ON priorityuser.user_id = users2.user_id 
          ${_where} ${single ? 'LIMIT 1' : ''}`, [query, single ? `${query}` : `%${query}%`]);
        await client.end();
        if (single) {
            if (rows.length == 0)
                throw new Error('No user found');
            else
                data = rows[0];
        } else {
            data = rows;
        }
    } catch (err) {
        throw new Error(err.message);
    }
    return data;
}