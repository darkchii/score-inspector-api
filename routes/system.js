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
const { InspectorUser, InspectorVisitor } = require('../helpers/db');
var expressStats = persistentCache();

const connConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
};

let cached_system_data = {
    osuAlt: {
        last_updated: 0,
        data: null
    },
    system: {
        last_updated: 0,
        data: null
    }
};

router.get('/', async (req, res, next) => {
    // let user_count = (await connection.awaitQuery(`SELECT count(*) as c FROM inspector_users`))?.[0]?.c ?? 0;
    const now = Date.now();
    let user_count = await InspectorUser.count();
    let total_visits = await InspectorVisitor.sum('count');
    //let total_visits = (await connection.awaitQuery(`SELECT sum(count) as c FROM inspector_visitors`))?.[0]?.c ?? 0;

    let expressRequests = expressStats.getSync('requests') ?? 0;
    let expressBytesSent = expressStats.getSync('size') ?? 0;

    //todo: optimize
    if(cached_system_data.osuAlt.last_updated < now - 1000 * 60 * 5 || !cached_system_data.osuAlt.data) {
        cached_system_data.osuAlt.data = await GetSystemInfo();
        cached_system_data.osuAlt.last_updated = now;
    }
    let osu_alt_data = cached_system_data.osuAlt.data;

    //todo: optimize
    console.time('sys time');
    await si.time();
    console.timeEnd('sys time');

    console.time('sys cpu');
    await si.cpu();
    console.timeEnd('sys cpu');

    console.time('sys os');
    await si.osInfo();
    console.timeEnd('sys os');

    if(cached_system_data.system.last_updated < now - 1000 * 60 * 5 || !cached_system_data.system.data) {
        cached_system_data.system.data = {
            time: await si.time(),
            cpu: await si.cpu(),
            os: await si.osInfo()
        }
        cached_system_data.system.last_updated = now;
    }

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
            system_time: cached_system_data.system.data.time,
            cpu: {
                manufacturer: cached_system_data.system.data.cpu.manufacturer,
                brand: cached_system_data.system.data.cpu.brand,
                cores: cached_system_data.system.data.cpu.cores
            },
            os: {
                platform: cached_system_data.system.data.os.platform,
                distro: cached_system_data.system.data.os.distro,
                release: cached_system_data.system.data.os.release,
                codename: cached_system_data.system.data.os.codename,
                arch: cached_system_data.system.data.os.arch,
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
