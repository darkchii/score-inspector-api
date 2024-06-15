const express = require('express');
var apicache = require('apicache');
const { GetUser: GetOsuUser, GetDailyUser, GetUsers, GetUserBeatmaps } = require('../../helpers/osu');
const { IsRegistered, GetAllUsers, GetUser: GetAltUser, FindUser, GetPopulation } = require('../../helpers/osualt');
const { getFullUsers } = require('../../helpers/inspector');
const { InspectorCompletionist, AltUser, Databases, InspectorHistoricalScoreRank } = require('../../helpers/db');
const { Op } = require('sequelize');
const { default: axios } = require('axios');

let cache = apicache.middleware;
const router = express.Router();

router.get('/osu/id/:id', cache('1 hour'), async (req, res) => {
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

router.get('/osu/beatmaps/:id/:type', cache('1 hour'), async (req, res) => {
  const mode = req.query.mode !== undefined ? req.query.mode : 0;
  const _type = req.params.type !== undefined ? req.params.type : 'ranked';
  const limit = req.query.limit !== undefined ? req.query.limit : 100;
  const offset = req.query.offset !== undefined ? req.query.offset : 0;
  let data = null;
  try {
    data = await GetUserBeatmaps(req.params.id, _type, limit, offset);
  } catch (err) {
    res.json({ error: 'Unable to get user beatmaps', message: err.message });
  }
  if (data !== null) {
    res.json(data);
  }
  // res.json(user);
});

router.get('/osu/ids', cache('1 hour'), async (req, res) => {
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

router.get('/osu/completionists', cache('1 hour'), async (req, res) => {
  try {
    const completionists = await InspectorCompletionist.findAll();

    const ids = completionists.map(c => c.osu_id);
    const full_users = await getFullUsers(ids, { daily: true, alt: false, score: false, osu: false });

    const data = completionists.map(c => {
      const user = full_users.find(u => u.osu.id == c.osu_id);
      return {
        osu_id: c.osu_id,
        mode: c.mode,
        completion_date: c.completion_date,
        scores: c.scores,
        user: user
      }
    });

    res.json(data);
  } catch (e) {
    console.error(e);
    res.json({ error: e.message });
  }
});

router.get('/daily/:id', cache('30 minutes'), async (req, res) => {
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

router.get('/alt/registered/:id', cache('10 minutes'), async function (req, res, next) {
  try {
    const registered = await IsRegistered(req.params.id);
    res.json(registered);
  } catch (e) {
    res.json(e.message);
  }
});

router.get('/alt/registered', cache('10 minutes'), async function (req, res, next) {
  try {
    const users = await GetAllUsers();
    res.json(users);
  } catch (e) {
    res.json(e.message);
  }
});

router.get('/alt/get/:id', cache('10 minutes'), async function (req, res, next) {
  try {
    const user = await GetAltUser(req.params.id);
    res.json(user);
  } catch (e) {
    res.json(e.message);
  }
});

router.get('/alt/find/:query', cache('10 minutes'), async function (req, res, next) {
  try {
    const users = await FindUser(req.params.query, req.query.single, false);
    res.json(users);
  } catch (e) {
    console.error(e);
    res.json(e);
  }
});

router.get('/population', cache('1 hour'), async (req, res) => {
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

router.get('/full/:ids', cache('10 minutes'), async (req, res, next) => {
  const skippedData = {
    daily: req.query.skipDailyData === 'true' ? true : false,
    alt: req.query.skipAltData === 'true' ? true : false,
    score: req.query.skipScoreRank === 'true' ? true : false,
    osu: req.query.skipOsuData === 'true' ? true : false,
    stats: req.query.skipStats === 'true' ? true : false,
    extras: req.query.skipExtras === 'true' ? true : false,
  }

  let ids = req.params.ids;

  if (typeof req.params.ids === 'string') {
    ids = req.params.ids.split(',').map(id => parseInt(id));
  }

  //remove duplicates
  ids = [...new Set(ids)];

  const data = await getFullUsers(ids, skippedData);

  if (ids.length === 1 && (req.query.force_array === undefined || req.query.force_array === 'false')) {
    //old way of returning user, we keep it for compatibility so we don't have to change the frontend
    res.json({
      inspector_user: data[0]?.inspector_user,
      osu: data[0].osu,
      daily: data[0].daily,
      alt: data[0].alt,
    });
  } else {
    res.json(data);
  }
});

router.get('/stats/:id', cache('1 hour'), async (req, res) => {
  const id = req.params.id;

  try {
    const user = await AltUser.findOne({
      where: { user_id: id },
    });

    const query = `
    SELECT
        count(*) as clears,
        count(case when scores.rank = 'X' then 1 end) as ss,
        count(case when scores.rank = 'XH' then 1 end) as ssh,
        count(case when scores.rank = 'S' then 1 end) as s,
        count(case when scores.rank = 'SH' then 1 end) as sh,
        count(case when scores.rank = 'A' then 1 end) as a,
        count(case when scores.rank = 'B' then 1 end) as b,
        count(case when scores.rank = 'C' then 1 end) as c,
        count(case when scores.rank = 'D' then 1 end) as d,
        sum(scores.pp) as total_pp,
        sum(scores.score) as total_score,
        sum(scores.count300+scores.count100+scores.count50) as total_hits,
        sum(beatmaps.length) as total_length,
        count(case when scores.perfect = '1' then 1 end) as perfect_clears,
        avg(scores.pp) as avg_pp,
        avg(scores.accuracy) as avg_acc,
        count(*)::float / (SELECT count(*) FROM beatmaps WHERE approved IN (1,2,4) AND mode=0) * 100 as completion
    FROM scores
    INNER JOIN beatmaps
    ON beatmaps.beatmap_id = scores.beatmap_id
    WHERE scores.user_id = ${id} AND mode = 0 AND approved IN (1,2,4)
    `;

    const [stats, scoreRankHistory, top50sData, currentScoreRank] = await Promise.allSettled([
      Databases.osuAlt.query(query),
      InspectorHistoricalScoreRank.findAll({
        where: {
          [Op.and]: [
            { osu_id: id },
            { date: { [Op.gte]: new Date(new Date() - 90 * 24 * 60 * 60 * 1000) } }
          ]
        },
        order: [
          ['date', 'ASC']
        ]
      }),
      axios.post('https://osustats.ppy.sh/api/getScores', {
        accMax: 100,
        gamemode: 0,
        page: 1,
        rankMax: 50,
        rankMin: 1,
        resultType: 1,
        sortBy: 0,
        sortOrder: 0,
        u1: user.username
      }),
      axios.get(`https://score.respektive.pw/u/${id}`, {
        headers: { "Accept-Encoding": "gzip,deflate,compress" }
      })
    ]);

    res.json({
      user: user,
      stats: {
        ...stats.value?.[0]?.[0] ?? {},
        top50s: top50sData?.value?.data?.[1] ?? [],
        scoreRank: currentScoreRank?.value?.data?.[0]?.rank ?? 0
      },
      scoreRankHistory: scoreRankHistory?.value ?? [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to get user', message: err.message });
  }
});


module.exports = router;