const { default: axios } = require('axios');
var apicache = require('apicache');
var express = require('express');
const request = require('request');
const { GetCountryLeaderboard } = require('../../helpers/osu');
var router = express.Router();
const { InspectorRole, InspectorUserRole, InspectorUser } = require('../../helpers/db');
require('dotenv').config();

let cache = apicache.middleware;

router.all('/proxy/:url', async (req, res) => {
  try {
    const url = Buffer.from(req.params.url, 'base64').toString('utf-8');
    req.pipe(request(url)).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/country_list', cache('1 hour'), async (req, res) => {
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

router.get('/roles', cache('1 hour'), async (req, res) => {
  var data = null;
  try {
    data = await InspectorRole.findAll({
      attributes: ['id', 'title', 'description', 'color', 'icon', 'is_visible', 'is_admin', 'is_listed'],
    });
  } catch (err) {
    res.json({ error: 'Unable to get data', message: err.message });
  }
  if (data !== null) {
    res.json(data);
  }
});

router.get('/roles/:id', cache('1 hour'), async (req, res) => {
  var data = null;
  try {
    // const role = await InspectorRole.findOne({
    //   where: { id: req.params.id },
    //   attributes: ['id', 'title', 'description', 'color', 'icon', 'is_visible', 'is_admin', 'is_listed'],
    // });

    const userRoles = await InspectorUserRole.findAll({
      where: { role_id: req.params.id },
    });

    const users = await InspectorUser.findAll({
      where: { id: userRoles.map((ur) => ur.user_id) },
      include: [
        {
          model: InspectorRole,
          attributes: ['id', 'title', 'description', 'color', 'icon', 'is_visible', 'is_admin', 'is_listed'],
          through: { attributes: [] },
          as: 'roles'
        }
      ]
    });

    data = users;
  }
  catch (err) {
    res.json({ error: 'Unable to get data', message: err.message });
  }
  if (data !== null) {
    res.json(data);
  }
});

module.exports = router;
