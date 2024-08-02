var express = require('express');
var router = express.Router();
const { IsReachable } = require('../../helpers/inspector');
var apicache = require('apicache');
const { GetSystemInfo } = require('../../helpers/osualt');
require('dotenv').config();
let cache = apicache.middleware;
const { InspectorUser, InspectorVisitor } = require('../../helpers/db');

router.get('/', async (req, res, next) => {
    let data = {};

    data.user_count = await InspectorUser.count();
    data.total_visits = await InspectorVisitor.sum('count');
    data.unique_visits = await InspectorVisitor.count({
        distinct: true,
        col: 'target_id'
    });
    data.osuAlt = await GetSystemInfo();
    res.json({
        database: {
            inspector: {
                user_count: data.user_count,
                total_visits: data.total_visits,
                unique_visits: data.unique_visits
            },
            alt: data.osuAlt
        }
    });
});

router.get('/status/', cache('1 hour'), async (req, res) => {
    const status = {};
    status.osualt = await IsReachable('osualt');
    status.osuv2 = await IsReachable('osuv2');
    res.json(status);
});

module.exports = router;
