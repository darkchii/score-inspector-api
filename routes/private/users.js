const express = require('express');
var apicache = require('apicache');
const { GetUsers, GetUserBeatmaps, MODE_SLUGS, GetOsuUser, GetOsuUserScores, ConvertOsuScoreResultToInspectorScore, MODS } = require('../../helpers/osu');
const { IsRegistered, GetAllUsers, GetUser: GetAltUser, FindUser, GetPopulation, GetScores } = require('../../helpers/osualt');
const { getFullUsers } = require('../../helpers/inspector');
const { InspectorCompletionist, AltUser, Databases, AltBeatmap, InspectorOsuUser, GetHistoricalScoreRankModel } = require('../../helpers/db');
const { Op, Sequelize } = require('sequelize');
const { default: axios } = require('axios');
const { validateString, getDataImageFromUrl } = require('../../helpers/misc');

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
    const full_users = await getFullUsers(ids, { alt: false, score: false, osu: false });

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
      alt: req.query.skipAltData === 'true' ? true : false,
      score: req.query.skipScoreRank === 'true' ? true : false,
      osu: req.query.skipOsuData === 'true' ? true : false,
      stats: req.query.skipStats === 'true' ? true : false,
      extras: req.query.skipExtras === 'true' ? true : false,
    }

    let ids = req.params.ids;

    if (typeof req.params.ids === 'string') {
      // ids = req.params.ids.split(',').map(id => parseInt(id));
      ids = req.params.ids.split(',');
    }

    //remove duplicates
    ids = [...new Set(ids)];

    //if the ids are usernames, we need to get the ids first
    if (ids.some(id => isNaN(id))) {
      //safe check names
      ids.forEach(id => {
        const res = validateString('username', id, 15, false);
        if (res.error) {
          res.status(400).json({ error: res.error });
          return;
        }
      });

      const users = await InspectorOsuUser.findAll({
        where: {
          //case insensitive search
          username: { [Op.in]: ids.map(id => id.toLowerCase()) }
        }
      });

      ids = users.map(u => u.user_id);
    }

    const data = await getFullUsers(ids, skippedData, false, req.query.force_alt_data === 'true', true);

    console.log(data[0]?.inspector_user);

    if (ids.length === 1 && (req.query.force_array === undefined || req.query.force_array === 'false')) {
      //old way of returning user, we keep it for compatibility so we don't have to change the frontend
      res.json({
        inspector_user: data[0]?.inspector_user,
        osu: data[0].osu,
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
          //fallback to 0 if value is null
          [Sequelize.fn('COALESCE', Sequelize.col('total_pp'), 0), 'total_pp'],
          [Sequelize.fn('COALESCE', Sequelize.col('alt_ssh_count'), 0), 'alt_ssh_count'],
          [Sequelize.fn('COALESCE', Sequelize.col('alt_ss_count'), 0), 'alt_ss_count'],
          [Sequelize.fn('COALESCE', Sequelize.col('alt_s_count'), 0), 'alt_s_count'],
          [Sequelize.fn('COALESCE', Sequelize.col('alt_sh_count'), 0), 'alt_sh_count'],
          [Sequelize.fn('COALESCE', Sequelize.col('alt_a_count'), 0), 'alt_a_count'],
          [Sequelize.literal('ss_count + ssh_count + s_count + sh_count + a_count'), 'profile_clears'],
          [Sequelize.literal('COALESCE(alt_ssh_count, 0) + COALESCE(alt_ss_count, 0) + COALESCE(alt_s_count, 0) + COALESCE(alt_sh_count, 0) + COALESCE(alt_a_count, 0) + b_count + c_count + d_count'), 'clears'],
          [Sequelize.literal('(COALESCE(alt_ssh_count, 0) + COALESCE(alt_ss_count, 0) + COALESCE(alt_s_count, 0) + COALESCE(alt_sh_count, 0) + COALESCE(alt_a_count, 0) + b_count + c_count + d_count) / ' + beatmap_count + ' * 100'), 'completion'],
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

  try {
    const beatmap_count = await AltBeatmap.count({
      where: {
        approved: { [Op.in]: [1, 2, 4] },
        mode: 0
      }
    });

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

const WRAPPED_YEAR = 2024;
const WRAPPED_SCORE_COUNT = 5;
router.get('/wrapped/:id', cache('1 hour'), async (req, res) => {
  if (isNaN(req.params.id)) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }

  try {
    const full_user = (await getFullUsers([req.params.id], { alt: false, score: false, osu: false }, false, false, true))?.[0];
    const user = await AltUser.findOne({ where: { user_id: req.params.id } });

    if (!user || !full_user || !full_user.osu) {
      throw new Error('User not found');
    }

    const data = {
      id: full_user.osu.id,
      username: full_user.osu.username,
      avatar: (await getDataImageFromUrl(full_user.osu.avatar_url)),
      cover: (await getDataImageFromUrl(full_user.osu.cover_url)),
      playcount: 0,
      replays_watched: 0,
      achievements: 0,
      badges: 0,
      clan_data: full_user.inspector_user?.clan_member,
    };

    //check user.osu.monthly_playcounts
    if (full_user.osu.monthly_playcounts) {
      for (const month of full_user.osu.monthly_playcounts) {
        if (month.start_date.startsWith(WRAPPED_YEAR)) {
          data.playcount += month.count;
        }
      }
    }

    if (full_user.osu.replays_watched_counts) {
      for (const month of full_user.osu.replays_watched_counts) {
        if (month.start_date.startsWith(WRAPPED_YEAR)) {
          data.replays_watched += month.count;
        }
      }
    }

    if (full_user.osu.user_achievements) {
      for (const achievement of full_user.osu.user_achievements) {
        const achieved_at = new Date(achievement.achieved_at);
        if (achieved_at.getFullYear() === WRAPPED_YEAR) {
          data.achievements++;
        }
      }
    }

    if (full_user.osu.badges) {
      for (const achievement of full_user.osu.badges) {
        const awarded_at = new Date(achievement.awarded_at);
        if (awarded_at.getFullYear() === WRAPPED_YEAR) {
          data.badges++;
        }
      }
    }

    const JOINS = `
      INNER JOIN beatmaps ON scores.beatmap_id = beatmaps.beatmap_id
      INNER JOIN users2 ON scores.user_id = users2.user_id
    `;

    const WHERES = `
    WHERE scores.user_id = :user_id
        AND beatmaps.approved IN (1, 2, 4)
        AND beatmaps.mode = 0
        AND scores.date_played >= :start_date
        AND scores.date_played < :end_date
    `

    const score_data = await Databases.osuAlt.query(`
        SELECT
          count(*) as total_scores,
          count(case when scores.rank = 'X' then 1 end) as ss,
          count(case when scores.rank = 'XH' then 1 end) as ssh,
          count(case when scores.rank = 'S' then 1 end) as s,
          count(case when scores.rank = 'SH' then 1 end) as sh,
          count(case when scores.rank = 'A' then 1 end) as a,
          count(case when scores.rank = 'B' then 1 end) as b,
          count(case when scores.rank = 'C' then 1 end) as c,
          count(case when scores.rank = 'D' then 1 end) as d,
          sum(scores.score) as score,
          sum(case when scores.rank = 'X' or scores.rank = 'XH' then scores.score end) as ss_score
        FROM scores
        ${JOINS}
        ${WHERES}
      `, {
      replacements: {
        user_id: req.params.id,
        start_date: `${WRAPPED_YEAR}-01-01 00:00:00`,
        end_date: `${WRAPPED_YEAR + 1}-01-01 00:00:00`
      },
      type: Databases.osuAlt.QueryTypes.SELECT
    });

    data.scores = score_data[0];

    //first we try get top plays from osu api

    data.top_pp_scores = [];
    let osu_top_plays = await GetOsuUserScores(req.params.id, 'best', 'osu');
    //filter out scores that are not from the wrapped year (osu_top_plays.ended_at, example: 2021-10-01T00:09:12Z)
    osu_top_plays = osu_top_plays?.filter(score => new Date(score.ended_at).getFullYear() === WRAPPED_YEAR);
    osu_top_plays = osu_top_plays.slice(0, WRAPPED_SCORE_COUNT);

    console.log(`osu_top_plays: ${osu_top_plays.length}`);
    for await (const score of osu_top_plays) {
      const inspector_score = await ConvertOsuScoreResultToInspectorScore(score, user);
      data.top_pp_scores.push(inspector_score);
    }

    if (osu_top_plays.length < WRAPPED_SCORE_COUNT) {
      let filler_pp_scores = await GetScores({
        query: {
          user_id: req.params.id,
          min_played_date: `${WRAPPED_YEAR}-01-01 00:00:00`,
          max_played_date: `${WRAPPED_YEAR + 1}-01-01 00:00:00`,
          order: 'pp',
          limit: WRAPPED_SCORE_COUNT,
          approved: '1,2,4',
        }
      });

      //filter out scores that are already in osu_top_plays
      filler_pp_scores = filler_pp_scores.filter(score => !osu_top_plays.some(s => s.beatmap_id === score.beatmap_id));

      //slice to remaining amount
      filler_pp_scores = filler_pp_scores.slice(0, WRAPPED_SCORE_COUNT - osu_top_plays.length);

      for await (const score of filler_pp_scores) {
        data.top_pp_scores.push(score);
      }

      //sort to make sure
    }

    //convert pp to number
    data.top_pp_scores = data.top_pp_scores.map(score => {
      score.pp = parseFloat(score.pp);
      return score;
    });

    data.top_pp_scores = data.top_pp_scores.sort((a, b) => b.pp - a.pp);

    data.top_score_scores = await GetScores({
      query: {
        user_id: req.params.id,
        min_played_date: `${WRAPPED_YEAR}-01-01 00:00:00`,
        max_played_date: `${WRAPPED_YEAR + 1}-01-01 00:00:00`,
        order: 'score',
        limit: WRAPPED_SCORE_COUNT,
        approved: '1,2,4',
      }
    });

    //add cover image data strings
    for await (const score of data.top_pp_scores) {
      score.beatmap.cover = await getDataImageFromUrl(`https://assets.ppy.sh/beatmaps/${score.beatmap.set_id}/covers/cover.jpg`);
    }

    for await (const score of data.top_score_scores) {
      score.beatmap.cover = await getDataImageFromUrl(`https://assets.ppy.sh/beatmaps/${score.beatmap.set_id}/covers/cover.jpg`);
    }

    //get most used mods
    const mod_counts = {};
    const mods_data = await Databases.osuAlt.query(`
      SELECT
        scores.beatmap_id,
        enabled_mods,
        scoresmods.mods
      FROM scores
      ${JOINS}
      LEFT JOIN scoresmods ON scores.beatmap_id = scoresmods.beatmap_id AND scores.user_id = scoresmods.user_id AND scores.date_played = scoresmods.date_played
      ${WHERES}
      `, {
      replacements: {
        user_id: req.params.id,
        start_date: `${WRAPPED_YEAR}-01-01 00:00:00`,
        end_date: `${WRAPPED_YEAR + 1}-01-01 00:00:00`
      }
    });

    for (const score of mods_data?.[0]) {
      if (score.mods) {
        for (const mod of score.mods) {
          if (!mod_counts[mod.acronym]) {
            mod_counts[mod.acronym] = 1;
          } else {
            mod_counts[mod.acronym]++;
          }
        }
      } else {
        const score_mods = score.enabled_mods;

        mod_counts["CL"] = mod_counts["CL"] ? mod_counts["CL"] + 1 : 1;
        for (let i = 0; i < MODS.length; i++) {
          if (score_mods & (1 << i)) {
            const mod = MODS[i];
            if (!mod_counts[mod]) {
              mod_counts[mod] = 1;
            } else {
              mod_counts[mod]++;
            }
          }
        }
      }
    }

    const mod_counts_array = Object.keys(mod_counts).map(mod => {
      return {
        mod: mod,
        count: mod_counts[mod]
      }
    });

    mod_counts_array.sort((a, b) => b.count - a.count);

    //order by count
    data.most_used_mods = mod_counts_array.slice(0, 3);

    //move grades to scores.grades
    data.scores.grades = {
      ssh: data.scores.ssh,
      ss: data.scores.ss,
      sh: data.scores.sh,
      s: data.scores.s,
      a: data.scores.a,
      b: data.scores.b,
      c: data.scores.c,
      d: data.scores.d,
    };

    delete data.scores.ss;
    delete data.scores.ssh;
    delete data.scores.s;
    delete data.scores.sh;
    delete data.scores.a;
    delete data.scores.b;
    delete data.scores.c;
    delete data.scores.d;

    return res.json(data);

  } catch (err) {
    res.status(500).json({ error: 'Unable to get user', message: err.message });
  }
});

const SS_RANK_PAGE_SIZE = 50;
router.get('/ss_rank/:page', cache('1 hour'), async (req, res) => {
  const page = req.params.page;

  if (isNaN(page)) {
    res.status(400).json({ error: 'Invalid page number' });
    return;
  }

  try {
    const users = await InspectorOsuUser.findAll({
      where: {
        [Op.and]: [
          { global_ss_rank: { [Op.gt]: 0 } },
        ]
      },
      order: [
        ['global_ss_rank', 'ASC']
      ],
      limit: SS_RANK_PAGE_SIZE,
      offset: (page - 1) * SS_RANK_PAGE_SIZE
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Unable to get users', message: err.message });
  }
});

module.exports = router;