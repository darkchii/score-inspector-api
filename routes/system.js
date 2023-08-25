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
    let data = {};

    await Promise.all([
        InspectorUser.count(),
        InspectorVisitor.sum('count'),
        expressStats.get('requests'),
        expressStats.get('size')
    ]).then((values) => {
        data.user_count = values[0];
        data.total_visits = values[1];
        data.expressRequests = values[2];
        data.expressBytesSent = values[3];
    });

    //todo: optimize
    if(cached_system_data.osuAlt.last_updated < now - 1000 * 60 * 5 || !cached_system_data.osuAlt.data) {
        cached_system_data.osuAlt.data = await GetSystemInfo();
        cached_system_data.osuAlt.last_updated = now;
    }
    let osu_alt_data = cached_system_data.osuAlt.data;

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
                user_count: data.user_count,
                total_visits: data.total_visits,
                api: {
                    requests: data.expressRequests,
                    bytes_sent: data.expressBytesSent
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

    await Promise.all([
        IsReachable('osualt'),
        IsReachable('osuv2'),
        IsReachable('beatmaps'),
        IsReachable('scorerank'),
        IsReachable('osudaily')
    ]).then((values) => {
        status.osualt = values[0];
        status.osuv2 = values[1];
        status.beatmaps = values[2];
        status.scorerank = values[3];
        status.osudaily = values[4];
    });

    res.json(status);
});

module.exports = router;
