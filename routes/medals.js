const express = require('express');
const moment = require('moment');
const mysql = require('mysql-await');
var apicache = require('apicache');
const rateLimit = require('express-rate-limit');
const { buildQuery } = require('../helpers/inspector');
const { AltModdedStars, AltBeatmap, AltBeatmapPack, Databases, InspectorMedal } = require('../helpers/db');
const { default: axios } = require('axios');
const { GetBeatmaps } = require('../helpers/osualt');

const router = express.Router();
let cache = apicache.middleware;

const limiter = rateLimit({
    windowMs: 60 * 1000, // 15 minutes
    max: 60, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.get('/get/', limiter, cache('1 hour'), async (req, res) => {
    let data = await InspectorMedal.findAll();
    res.json(data ?? []);
});

module.exports = router;
