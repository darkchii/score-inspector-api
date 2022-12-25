var express = require('express');
var router = express.Router();
require('dotenv').config();

router.get('/proxy/:url', async (req, res) => {
  const url = Buffer.from(req.params.url, 'base64').toString('utf-8');
  const _res = await axios.get(url);

  res.json(_res.data);
});

router.get('/osu_client_id', async (req, res) => {
  let id = null;
  if (process.env.NODE_ENV === 'development') {
    id = process.env.OSU_CLIENT_ID_DEV;
  } else {
    id = process.env.OSU_CLIENT_ID;
  }

  res.json({ id: id });
});

module.exports = router;
