var express = require('express');
var router = express.Router();
const os = require("os");
const si = require('systeminformation');
const mysql = require('mysql-await');
const { IsReachable } = require('../helpers/inspector');
var apicache = require('apicache');
const { GetSystemInfo } = require('../helpers/osualt');
const { uptime } = require('process');
require('dotenv').config();
let cache = apicache.middleware;
var persistentCache = require('persistent-cache');
var expressStats = persistentCache();

const connConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
};

router.get('/', async (req, res, next) => {
    const connection = mysql.createConnection(connConfig);
    connection.on('error', (err) => { });

    let user_count = (await connection.awaitQuery(`SELECT count(*) as c FROM inspector_users`))?.[0]?.c ?? 0;
    let total_visits = (await connection.awaitQuery(`SELECT sum(count) as c FROM inspector_visitors`))?.[0]?.c ?? 0;
    await connection.end();

    let expressRequests = expressStats.getSync('requests') ?? 0;
    let expressBytesSent = expressStats.getSync('size') ?? 0;

    let osu_alt_data = await GetSystemInfo();

    const time = await si.time();
    const cpu = await si.cpu();
    const mem = await si.mem();
    const _os = await si.osInfo();
    const network = await si.networkInterfaces('default');

    res.json({
        database: {
            inspector: {
                user_count: user_count,
                total_visits: total_visits,
                api: {
                    requests: expressRequests,
                    bytes_sent: expressBytesSent
                }
            },
            alt: osu_alt_data
        },
        system: {
            uptime: uptime(),
            system_time: time,
            cpu: {
                manufacturer: cpu.manufacturer,
                brand: cpu.brand,
                cores: cpu.cores
            },
            memory: mem,
            os: {
                platform: _os.platform,
                distro: _os.distro,
                release: _os.release,
                codename: _os.codename,
                arch: _os.arch,
            },
            network: {
                ifaceName: network.ifaceName,
                iface: network.iface,
                type: network.type,
                speed: network.speed
            }
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
