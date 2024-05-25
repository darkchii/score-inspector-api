const express = require('express');
const moment = require('moment');
const mysql = require('mysql-await');
var apicache = require('apicache');
const { buildQuery } = require('../../helpers/inspector');
const { AltModdedStars, AltBeatmap, AltBeatmapPack, Databases, InspectorMedal } = require('../../helpers/db');
const { default: axios } = require('axios');
const { GetBeatmaps } = require('../../helpers/osualt');

const router = express.Router();
let cache = apicache.middleware;

router.get('/get/', cache('1 hour'), async (req, res) => {
    try{
        let data = await InspectorMedal.findAll();
        res.json(data ?? []);
    }catch(e){
        console.error(e);
        res.status(500).json({ error: e });
    }
});

module.exports = router;
