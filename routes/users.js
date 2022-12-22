const express = require('express');
const { GetUser: GetOsuUser, GetDailyUser } = require('../helpers/osu');
const { IsRegistered, GetAllUsers, GetUser: GetAltUser, FindUser } = require('../helpers/osualt');

const router = express.Router();

router.get('/osu/:id', async (req, res) => {
  const mode = req.query.mode !== undefined ? req.query.mode : 0;
  let user = null;
  try {
    user = await GetOsuUser(req.params.id, 'osu', 'id');
  } catch (err) {
    try {
      user = await GetOsuUser(req.params.id, 'osu', 'username');
    } catch (_err) {
      res.json({ error: 'Unable to get user', message: err.message });
    }
  }
  if (user !== null) {
    res.json(user);
  }
  // res.json(user);
});

router.get('/daily/:id', async (req, res) => {
  const mode = req.query.mode !== undefined ? req.query.mode : 0;
  let user = null;
  try {
    user = await GetDailyUser(req.params.id, 0, 'id');
  } catch (err) {
    res.json({ error: 'Unable to get user' });
  }
  if (user !== null) {
    res.json(user);
  }
  // res.json(user);
});

router.get('/alt/registered/:id', async function (req, res, next) {
  try {
    const registered = await IsRegistered(req.params.id);
    res.json(registered);
  } catch (e) {
    res.json(e.message);
  }
});

router.get('/alt/registered', async function (req, res, next) {
  try {
    const users = await GetAllUsers();
    res.json(users);
  } catch (e) {
    res.json(e.message);
  }
});

router.get('/alt/get/:id', async function (req, res, next) {
  try {
    const user = await GetAltUser(req.params.id);
    res.json(user);
  } catch (e) {
    res.json(e.message);
  }
});

router.get('/alt/find/:query', async function (req, res, next) {
  try {
    const users = await FindUser(req.params.query, req.query.single);
    res.json(users);
  } catch (e) {
    res.json(e.message);
  }
});

router.get('/full/:id', async (req, res, next) => {
  let osuUser;
  let dailyUser;
  let altUser;

  try {
    osuUser = await GetOsuUser(req.params.id, 'osu', 'id');
    dailyUser = await GetDailyUser(req.params.id, 0, 'id');
    altUser = await GetAltUser(req.params.id);
  } catch (e) {
    res.json(e.message);
  }

  res.json({
    osu: osuUser,
    daily: dailyUser,
    alt: altUser,
  });
});


module.exports = router;