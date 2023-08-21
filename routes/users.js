const express = require('express');
var apicache = require('apicache');
const { GetUser: GetOsuUser, GetDailyUser, GetUsers, GetUserBeatmaps, GetUser } = require('../helpers/osu');
const { IsRegistered, GetAllUsers, GetUser: GetAltUser, GetUsers: GetAltUsers, FindUser, GetPopulation } = require('../helpers/osualt');
const rateLimit = require('express-rate-limit');
const { default: axios } = require('axios');
const { InspectorUser, InspectorRole } = require('../helpers/db');
const { GetInspectorUser, DefaultInspectorUser } = require('../helpers/inspector');

let cache = apicache.middleware;
const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.get('/osu/id/:id', limiter, cache('1 hour'), async (req, res) => {
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

router.get('/osu/beatmaps/:id/:type', limiter, cache('1 hour'), async (req, res) => {
  const mode = req.query.mode !== undefined ? req.query.mode : 0;
  const _type = req.params.type !== undefined ? req.params.type : 'ranked';
  const limit = req.query.limit !== undefined ? req.query.limit : 100;
  const offset = req.query.offset !== undefined ? req.query.offset : 0;
  let data = null;
  try {
    data = await GetUserBeatmaps(req.params.id, _type, limit, offset);
    console.log('beatmaps: ', data.length);
  } catch (err) {
    res.json({ error: 'Unable to get user beatmaps', message: err.message });
  }
  if (data !== null) {
    res.json(data);
  }
  // res.json(user);
});

router.get('/osu/ids', limiter, cache('1 hour'), async (req, res) => {
  const ids = req.query.id;
  const mode = req.query.mode !== undefined ? req.query.mode : 0;
  let data;
  try {
    data = await GetUsers(ids);
  } catch (err) {
    res.json({ error: 'Unable to get users' });
    return;
  }

  let end_data = [];
  ids.forEach(id => {
    let user = data?.users.find(user => user.id == id);
    if (user) {
      end_data.push(user);
    } else {
      end_data.push({
        id: id,
        error: 'Unable to get user'
      });
    }
  });

  res.json(end_data)
});

router.get('/daily/:id', limiter, cache('30 minutes'), async (req, res) => {
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

router.get('/alt/registered/:id', limiter, cache('10 minutes'), async function (req, res, next) {
  try {
    const registered = await IsRegistered(req.params.id);
    res.json(registered);
  } catch (e) {
    res.json(e.message);
  }
});

router.get('/alt/registered', limiter, cache('10 minutes'), async function (req, res, next) {
  try {
    const users = await GetAllUsers();
    res.json(users);
  } catch (e) {
    res.json(e.message);
  }
});

router.get('/alt/get/:id', limiter, cache('10 minutes'), async function (req, res, next) {
  try {
    const user = await GetAltUser(req.params.id);
    res.json(user);
  } catch (e) {
    res.json(e.message);
  }
});

router.get('/alt/find/:query', limiter, cache('10 minutes'), async function (req, res, next) {
  try {
    const users = await FindUser(req.params.query, req.query.single, false);
    res.json(users);
  } catch (e) {
    res.json(e.message);
  }
});

router.get('/population', limiter, cache('1 hour'), async (req, res) => {
  let data = null;
  try {
    data = await GetPopulation();
  } catch (e) {
    res.json({ error: 'Unable to get population', message: e.message });
  }
  if (data !== null) {
    res.json(data);
  } else {
    res.json({ error: 'Unable to get population' });
  }
});

router.get('/full/:ids', limiter, cache('10 minutes'), async (req, res, next) => {
  const skippedData = {
    daily: req.query.skipDailyData === 'true' ? true : false,
    alt: req.query.skipAltData === 'true' ? true : false,
    score: req.query.skipScoreRank === 'true' ? true : false,
  }

  console.log(`Skipped data:`);
  console.log(skippedData);

  //split ids in array of integers
  let ids = req.params.ids.split(',').map(id => parseInt(id));

  console.log(ids);
  let data = [];

  //we create arrays of each type of user data, and then we merge them together
  let inspector_users = [];
  let osu_users = [];
  let daily_users = [];
  let alt_users = [];
  let score_ranks = [];

  await Promise.all([
    //inspector users
    InspectorUser.findAll({
      where: {
        osu_id: ids
      },
      include: [{
        model: InspectorRole,
        attributes: ['id', 'title', 'description', 'color', 'icon', 'is_visible', 'is_admin', 'is_listed'],
        through: { attributes: [] },
        as: 'roles'
      }]
    }).then(users => {
      inspector_users = users;
    }),
    //osu users
    ids.length === 1 ? GetUser(ids[0], 'osu', 'id').then(user => {
      osu_users = [user];
    }) : GetUsers(ids).then(users => {
      osu_users = users;
    }),
    //daily users
    skippedData.daily ? null : Promise.all(ids.map(id => GetDailyUser(id, 0, 'id'))).then(users => {
      daily_users = users;
    }),
    //alt users
    skippedData.alt ? null : GetAltUsers(ids, ids.length===1).then(users => {
      alt_users = JSON.parse(JSON.stringify(users));
    }),
    //score ranks
    skippedData.score ? null : axios.get(`https://score.respektive.pw/u/${ids.join(',')}`, {
      headers: { "Accept-Encoding": "gzip,deflate,compress" }
    }).then(res => {
      score_ranks = res.data;
    })
  ]);

  //we merge the data together
  ids.forEach(id => {
    let user = {};

    let osu_user = osu_users.find(user => user.id == id);
    if (!osu_user) return;
    let score_rank = score_ranks.find(user => user.user_id == id);
    user.osu = { ...osu_user, score_rank };

    let inspector_user = inspector_users.find(user => user.osu_id == id);
    user.inspector_user = DefaultInspectorUser(inspector_user, osu_user.username, osu_user.id);

    if (!skippedData.daily) {
      try {
        let daily_user = daily_users.find(user => user.osu_id == id);
        user.daily = daily_user;
      } catch (err) {

      }
    }

    if (!skippedData.alt) {
      let alt_user = alt_users.find(user => user.user_id == id);
      user.alt = alt_user;
    }

    data.push(user);
  });

  console.log(`Array or not?`);
  console.log(`IDs length: ${ids.length}, expected length: 1`);
  console.log(`Force array: ${req.query.force_array}, expected: false`);
  if (ids.length === 1 && (req.query.force_array === undefined || req.query.force_array === 'false')) {
    //old way of returning user, we keep it for compatibility so we don't have to change the frontend
    console.log(`Returning single user`);
    res.json({
      inspector_user: data[0].inspector_user,
      osu: data[0].osu,
      daily: data[0].daily,
      alt: data[0].alt,
    });
  } else {
    res.json(data);
  }

  // let osuUser;
  // let dailyUser;
  // let altUser;
  // let scoreRank;
  // let inspector_user;

  // try {
  //   // console.log('osu api');
  //   try {
  //     osuUser = await GetOsuUser(req.params.id, 'osu', 'id');
  //   } catch (e) {
  //     osuUser = await GetOsuUser(req.params.id, 'osu', 'username');
  //   }
  //   const real_id = osuUser?.id;
  //   if (!real_id) {
  //     throw new Error('User not found');
  //   }

  //   if (!skippedData.daily) {
  //     dailyUser = await GetDailyUser(real_id, 0, 'id');
  //   }

  //   if (!skippedData.alt) {
  //     altUser = await GetAltUser(real_id);
  //   }

  //   inspector_user = await GetInspectorUser(req.params.id);
  // } catch (e) {
  //   console.error(e);
  //   res.json({ error: 'Unable to get user', message: e });
  //   return;
  // }

  // if (!skippedData.score) {
  //   try {
  //     let scoreRes = await axios.get(`https://score.respektive.pw/u/${req.params.id}`, {
  //       headers: { "Accept-Encoding": "gzip,deflate,compress" }
  //     });
  //     scoreRank = scoreRes.data?.[0]?.rank;
  //   } catch (e) {
  //     //nothing
  //   }
  // }

  // res.json({
  //   inspector_user: inspector_user,
  //   osu: { ...osuUser, scoreRank },
  //   daily: dailyUser,
  //   alt: altUser,
  // });
});


module.exports = router;