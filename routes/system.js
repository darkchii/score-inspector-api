var express = require('express');
var router = express.Router();
const si = require('systeminformation');
const mysql = require('mysql-await');
const { IsReachable } = require('../helpers/inspector');
var apicache = require('apicache');
require('dotenv').config();
let cache = apicache.middleware;

const connConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
};

router.get('/', cache('30 minutes'), async (req, res) => {
    const connection = mysql.createConnection(connConfig);
    connection.on('error', (err) => { });

    let user_count = (await connection.awaitQuery(`SELECT count(*) as c FROM inspector_users`))?.[0]?.c ?? 0;
    let total_visits = (await connection.awaitQuery(`SELECT sum(count) as c FROM inspector_visitors`))?.[0]?.c ?? 0;
    await connection.end();

    const time = await si.time();
    const cpu = await si.cpu();
    const mem = await si.mem();
    const _os = await si.osInfo();

    res.json({
        database: {
            inspector: {
                user_count: user_count,
                total_visits: total_visits,
            }
        },
        system: {
            system_time: time,
            cpu: cpu,
            memory: mem,
            os: {
                platform: _os.platform,
                distro: _os.distro,
                release: _os.release,
                codename: _os.codename,
                arch: _os.arch,
            },
        }
    });
});

router.get('/status/', cache('1 hour'), async (req, res) => {
    const status = {};

    //check osualt database
    status.osualt = await IsReachable('osualt');
    status.osuv2 = await IsReachable('osuv2');
    status.beatmaps = await IsReachable('beatmaps');
    status.scorerank = await IsReachable('scorerank');
    status.osudaily = await IsReachable('osudaily');

    res.json(status);
});

module.exports = router;
