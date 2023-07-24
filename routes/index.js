const { default: axios } = require('axios');
var apicache = require('apicache');
var express = require('express');
const request = require('request');
const { RankTest, GetCountryLeaderboard } = require('../helpers/osu');
var router = express.Router();
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const limiter = rateLimit({
  windowMs: 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

let cache = apicache.middleware;

router.get('/proxy/:url', async (req, res) => {
  try {
    const url = Buffer.from(req.params.url, 'base64').toString('utf-8');
    req.pipe(request(url)).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/country_list', limiter, cache('1 hour'), async (req, res) => {
  var data = null;
  try {
    data = await GetCountryLeaderboard();
  } catch (err) {
    res.json({ error: 'Unable to get data', message: err.message });
  }
  if (data !== null) {
    res.json(data);
  }
  // res.json(user);
});

module.exports = router;
