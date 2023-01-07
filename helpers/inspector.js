const { Client } = require("pg");
const { GetUser, GetDailyUser } = require("./osu");
const mysql = require('mysql-await');
const { default: axios } = require("axios");
require('dotenv').config();

const connConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
};

module.exports.IsReachable = IsReachable;
async function IsReachable(endpoint) {
    let reachable = false;

    switch (endpoint) {
        case 'osudaily':
            try{
                const data = await GetDailyUser(10153735, 0, 'id', 1000);
                if (data?.osu_id == 10153735) reachable = true;
            }catch(e){}
            break;
        case 'scorerank':
            try{
                const data = await axios.get('https://score.respektive.pw/u/10153735', { timeout: 1000 });
                if (data?.data?.[0] !== null) reachable = true;
            }catch(e) {}
            break;
        case 'beatmaps':
            try {
                const connection = mysql.createConnection(connConfig);
                connection.on('error', (err) => { });
                const result = await connection.awaitQuery(`SELECT count(*) FROM beatmap`);
                if (result?.[0]?.['count(*)'] > 0) reachable = true;
                await connection.end();
            } catch (e) { }
            break;
        case 'osuv2':
            try {
                const test_user = await GetUser('peppy', 'osu', 'username', 1000);
                if (test_user?.id == 2) reachable = true;
            } catch (e) { }
            break;
        case 'osualt':
            try {
                const client = new Client({
                    query_timeout: 1000,
                    connectionTimeoutMillis: 1000,
                    statement_timeout: 1000,
                    user: process.env.ALT_DB_USER,
                    host: process.env.ALT_DB_HOST,
                    database: process.env.ALT_DB_DATABASE,
                    password: process.env.ALT_DB_PASSWORD,
                    port: process.env.ALT_DB_PORT
                });
                await client.connect();
                const res = await client.query('SELECT 1');
                await client.end();
                if (res.rowCount > 0) reachable = true;
            } catch (err) {
            }
            break;
    }
    return reachable;
}