const express = require('express');
const { Models } = require('../helpers/db');
const { convertToQueryFilter, sanitizeFilter, fixInputQuery } = require('../helpers/filters');
const { Op, fn } = require('sequelize');
const { checkAuth } = require('../helpers/auth');

const router = express.Router();

router.get('/', async (req, res) => {
    const _query = fixInputQuery(req.query);
    const authenticated = await checkAuth(req);
    let limit = (_query.limit || 10);
    if (!authenticated) {
        limit = Math.min(limit, 50);
    }
    const offset = _query.offset || 0;
    const order = _query.order || "beatmap_id";
    const orderDirection = _query.orderDirection || "ASC";

    //deal everything else as filters, min and max for numeric values
    const filters = convertToQueryFilter(Models.altBeatmap, sanitizeFilter(_query));

    const beatmaps = await Models.altBeatmap.findAll({
        where: {
            [Op.and]: filters
        },
        limit: limit,
        offset: offset,
        order: [[order, orderDirection]]
    });

    const total_count = await Models.altBeatmap.count({
        where: {
            [Op.and]: filters
        }
    });

    res.json({
        beatmaps: beatmaps,
        total_count: total_count,
        total_pages: Math.ceil(total_count / limit),
    });
});

module.exports = router;
