const { default: axios } = require('axios');
var express = require('express');
const request = require('request');
const { RankTest } = require('../helpers/osu');
var router = express.Router();
require('dotenv').config();

router.get('/proxy/:url', async (req, res) => {
  try{
    const url = Buffer.from(req.params.url, 'base64').toString('utf-8');
    // const _res = await axios.get(url);
    request.get(url).pipe(res);
  }catch(err){
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
