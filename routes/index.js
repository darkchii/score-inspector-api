var express = require('express');
const { RankTest } = require('../helpers/osu');
var router = express.Router();
require('dotenv').config();

router.get('/proxy/:url', async (req, res) => {
  const url = Buffer.from(req.params.url, 'base64').toString('utf-8');
  const _res = await axios.get(url);

  res.json(_res.data);
});

module.exports = router;
