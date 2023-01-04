var express = require('express');
var router = express.Router();
const si = require('systeminformation');
const mysql = require('mysql-await');
require('dotenv').config();

const connConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
};

router.get('/', async (req, res) => {
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

module.exports = router;
