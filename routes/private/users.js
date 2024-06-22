const express = require('express');
var apicache = require('apicache');
const { GetUser: GetOsuUser, GetDailyUser, GetUsers, GetUserBeatmaps, MODE_SLUGS } = require('../../helpers/osu');
const { IsRegistered, GetAllUsers, GetUser: GetAltUser, FindUser, GetPopulation } = require('../../helpers/osualt');
const { getFullUsers } = require('../../helpers/inspector');
const { InspectorCompletionist, AltUser, Databases, AltBeatmap, InspectorOsuUser, GetHistoricalScoreRankModel } = require('../../helpers/db');
const { Op, Sequelize } = require('sequelize');
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
  try {
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
  } catch (err) {
    res.status(500).json({ error: 'Unable to get user', message: err.message });
  }
});

router.get('/stats/:id', cache('1 hour'), async (req, res) => {
  const id = req.params.id;
  const mode = req.query.mode !== undefined ? req.query.mode : 0;
  const username = req.query.username !== undefined ? req.query.username : null;

  try {
    const user = await AltUser.findOne({
      where: { user_id: id },
    });

    const beatmap_count = await AltBeatmap.count({
      where: {
        approved: { [Op.in]: [1, 2, 4] },
        mode: 0
      }
    });

    const [stats, scoreRankHistory, top50sData, currentScoreRank] = await Promise.allSettled([
      mode == 0 ? InspectorOsuUser.findOne({
        attributes: [
          'user_id',
          ['ss_count', 'ss'],
          ['ssh_count', 'ssh'],
          ['s_count', 's'],
          ['sh_count', 'sh'],
          ['a_count', 'a'],
          ['b_count', 'b'],
          ['c_count', 'c'],
          ['d_count', 'd'],
          'total_pp',
          [Sequelize.literal('ss_count + ssh_count + s_count + sh_count + a_count + b_count + c_count + d_count'), 'clears'],
          [Sequelize.literal('(ss_count + ssh_count + s_count + sh_count + a_count + b_count + c_count + d_count) / ' + beatmap_count + ' * 100'), 'completion'],
          'global_ss_rank',
          'country_ss_rank',
          'global_ss_rank_highest',
          'country_ss_rank_highest',
          'global_ss_rank_highest_date',
          'country_ss_rank_highest_date',
        ],
        where: { user_id: id },
      }) : null,
      (GetHistoricalScoreRankModel(MODE_SLUGS[mode])).findAll({
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
        accMax: "100",
        gamemode: mode,
        page: "1",
        rankMax: "50",
        rankMin: "1",
        resultType: "1",
        sortBy: "0",
        sortOrder: "0",
        u1: user?.username ?? username
      }),
      mode == 0 ? axios.get(`https://score.respektive.pw/u/${id}`, {
        headers: { "Accept-Encoding": "gzip,deflate,compress" }
      }) : null
    ]);

    res.json({
      user: user,
      stats: {
        ...stats?.value?.dataValues ?? {},
        top50s: top50sData?.value?.data?.[1] ?? [],
        scoreRank: currentScoreRank?.value?.data?.[0]?.rank ?? 0
      },
      scoreRankHistory: scoreRankHistory?.value ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to get user', message: err.message });
  }
});

router.get('/stats/completion_percentage/:ids', cache('2 hours'), async (req, res) => {
  let ids = req.params.ids;
  if (typeof req.params.ids === 'string') {
    ids = req.params.ids.split(',').map(id => parseInt(id));
  }

  if (!ids || ids.length === 0) {
    res.status(400).json({ error: 'No user ids provided' });
    return;
  }

  if (ids.length > 50) {
    res.status(400).json({ error: 'Too many user ids provided' });
    return;
  }

  const beatmap_count = await AltBeatmap.count({
    where: {
      approved: { [Op.in]: [1, 2, 4] },
      mode: 0
    }
  });

  try {
    // const query = `
    //   SELECT s.user_id, round((cast(count(*) * 100::float / ${beatmap_count} as numeric)), 3)
    //   FROM scores s
    //   WHERE s.user_id IN (${ids.join(',')})
    //   GROUP BY s.user_id
    //   LIMIT 50;
    // `;
    // const data = await Databases.osuAlt.query(query);
    const users = await InspectorOsuUser.findAll({
      where: {
        user_id: { [Op.in]: ids }
      }
    });

    const result = [];
    for (const user of users) {
      const clears = user.ssh_count + user.ss_count + user.sh_count + user.s_count + user.a_count + user.b_count + user.c_count + user.d_count;
      result.push({
        user_id: user.user_id,
        completion: (clears / beatmap_count * 100) || 0
      });
    }

    //reorder the result to match the order of the input ids
    const orderedResult = [];
    for (const id of ids) {
      const entry = result.find(r => r.user_id === id);
      if (entry) {
        orderedResult.push(entry);
      }
    }

    res.json(orderedResult);
  } catch (err) {
    res.status(500).json({ error: 'Unable to get user', message: err.message });
  }
});


module.exports = router;