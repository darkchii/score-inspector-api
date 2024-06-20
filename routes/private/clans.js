const express = require('express');
const { VerifyToken, getFullUsers, GetInspectorUser } = require('../../helpers/inspector');
const { InspectorClanMember, InspectorClan, InspectorClanStats, AltScore, InspectorOsuUser } = require('../../helpers/db');
const { Op } = require('sequelize');
const { IsUserClanOwner } = require('../../helpers/clans');
const router = express.Router();
require('dotenv').config();

const CLAN_MEMBER_LIMIT = 100;

const stat_rankings = [
    { key: 'clears', query: 'clears' },
    { key: 'total_ss', query: 'total_ssh+total_ss' },
    { key: 'total_s', query: 'total_sh+total_s' },
    { key: 'total_a', query: 'total_a' },
    { key: 'total_b', query: 'total_b' },
    { key: 'total_c', query: 'total_c' },
    { key: 'total_d', query: 'total_d' },
    { key: 'playcount', query: 'playcount' },
    { key: 'playtime', query: 'playtime' },
    { key: 'ranked_score', query: 'ranked_score' },
    { key: 'total_score', query: 'total_score' },
    { key: 'replays_watched', query: 'replays_watched' },
    { key: 'total_hits', query: 'total_hits' },
    { key: 'average_pp', query: 'average_pp' },
    { key: 'total_pp', query: 'total_pp' },
    { key: 'accuracy', query: 'accuracy' }
]

const CLANS_PER_PAGE = 50;
router.get('/list', async (req, res, next) => {
    const page = req.query.page || null;
    let limit = req.query.limit || 10;
    let sort = req.query.sort || 'clan_id';
    let order = req.query.order || 'ASC';
    if(!page){
        limit = 1000;
    }

    limit = parseInt(limit);
    limit = Math.min(limit, 1000);
    limit = Math.max(limit, 1);

    const clans = await InspectorClan.findAll({
        include: [
            {
                model: InspectorClanStats,
                as: 'clan_stats',
            },
            {
                model: InspectorClanMember,
                as: 'clan_members',
                where: {
                    pending: false
                }
            }
        ],
        limit: limit,
        //only if page is defined
        offset: page ? (page - 1) * CLANS_PER_PAGE : 0,
        // order: [[sort, order]]
        //order by clan_stats key
        order: [
            [{ model: InspectorClanStats, as: 'clan_stats' }, sort, order]
        ]
    });

    res.json({ clans: clans });
});

router.post('/create', async (req, res, next) => {
    //first we check osu_id and token, to see if the user is valid
    const user_id = req.body.user.id;
    const token = req.body.user.token;

    try {
        if (!(await VerifyToken(token, user_id))) {
            res.json({ error: "Invalid token" });
            return;
        }
    } catch (error) {
        res.json({ error: "An error occurred" });
        return;
    }

    //then we check if the user is already in a clan
    //if they are, we return an error

    const user_clan = await InspectorClanMember.findOne({
        where: {
            osu_id: user_id
        }
    });

    if (user_clan) {
        res.json({ error: "User is already in a clan" });
        return;
    }

    //then we check if the clan name or tag is already taken
    //if they are, we return an error

    const clan_name = req.body.name;
    const clan_tag = req.body.tag;

    const clan_name_taken = await InspectorClan.findOne({
        where: {
            [Op.or]: [
                { name: clan_name },
                { tag: clan_tag }
            ]
        }
    });

    if (clan_name_taken) {
        res.json({ error: "Clan name or tag is already taken" });
        return;
    }

    //if everything is good, we create the clan
    //we also add the user to the clan

    const validate = (key, value, max_length, is_url = false) => {
        //check for max length
        if (value.length > max_length) {
            res.json({ error: `${key} is too long: ${value}` });
            return false;
        }

        //check for invalid characters (unicode)
        if (!/^[\x00-\x7F]*$/.test(value)) {
            res.json({ error: `Invalid characters in ${key}: ${value}` });
            return false;
        }

        //check for invalid characters (special, if not url)
        if (!/^[\w\s]*$/.test(value) && !is_url) {
            res.json({ error: `Invalid characters in ${key}: ${value}` });
            return false;
        }

        return true;
    }

    if (!validate('name', clan_name, 20)) return;
    if (!validate('tag', clan_tag, 5)) return;
    if (!validate('description', req.body.description, 100)) return;
    if (!validate('color', req.body.color, 6)) return;

    // if (clan_name.length > 20) {
    //     res.json({ error: "Clan name is too long" });
    //     return;
    // }

    // if (clan_tag.length > 5) {
    //     res.json({ error: "Clan tag is too long" });
    //     return;
    // }

    // if (req.body.description.length > 100) {
    //     res.json({ error: "Clan description is too long" });
    //     return;
    // }

    // if (req.body.color.length > 6) {
    //     res.json({ error: "Clan color string is too long" });
    //     return;
    // }

    const new_clan = await InspectorClan.create({
        name: clan_name,
        tag: clan_tag,
        owner: user_id,
        description: req.body.description,
        color: req.body.color,
        creation_date: new Date()
    });

    const new_member = await InspectorClanMember.create({
        clan_id: new_clan.id,
        osu_id: user_id,
        pending: false,
        join_date: new Date()
    });

    const new_stats = await InspectorClanStats.create({
        clan_id: new_clan.id
    });

    res.json({ clan: new_clan, member: new_member, stats: new_stats });
});

router.get('/user/:id', async (req, res, next) => {
    //can be one or multiple ids, separated by commas
    let ids = req.params.id.split(',');
    //only numbers are allowed
    ids = ids.filter(id => !isNaN(id));

    if(ids.length == 0) {
        res.status(400).json({ error: "Invalid user id" });
        return;
    }

    //we only care about clan info, not user info
    const members = await InspectorClanMember.findAll({
        where: {
            osu_id: ids,
            pending: false
        },
        include: [
            {
                model: InspectorClan,
                as: 'clan'
            }
        ]
    });

    res.json(members);
});

router.all('/get/:id', async (req, res, next) => {
    const login_user_id = req.body.login_user_id;
    const login_token = req.body.login_user_token;
    let allow_pending = false;

    if (login_user_id && login_token) {
        try {
            if ((await VerifyToken(login_token, login_user_id))) {
                allow_pending = true;
            }
        } catch (err) {
            allow_pending = false;
        }
    }

    const clan_id = req.params.id;
    const clan = await InspectorClan.findOne({
        where: {
            id: clan_id
        }
    });

    if (!clan) {
        res.json({ error: "Clan not found" });
        return;
    }

    const members = await InspectorClanMember.findAll({
        where: {
            clan_id: clan_id,
            pending: allow_pending ? { [Op.or]: [true, false] } : false
        }
    });

    //get full user info for each member
    const ids = members.map(m => m.osu_id);
    let full_users = await getFullUsers(ids, { daily: true, alt: false, score: true, osu: true }, true);

    //for those missing "alt" data, we need to fetch it separately with osu: false
    //use "ids" to get the missing users, then merge them with the full_users array
    const missing_ids = ids.filter(id => !full_users.find(u => u.alt?.user_id == id));
    if (missing_ids.length > 0) {
        let missing_users = await getFullUsers(missing_ids, { daily: true, alt: true, score: true, osu: false }, true);

        full_users = full_users.map(u => {
            const missing_user = missing_users.find(mu => mu.osu?.id == u.inspector_user.osu_id);
            if (missing_user) {
                u.osu = missing_user.osu;
            }
            return u;
        });
    }

    let _members = [];

    for await (const m of members) {
        const user = full_users.find(u => u.osu?.id == m.osu_id || u.alt?.user_id == m.osu_id || u.inspector_user?.osu_id == m.osu_id);

        let _data = {
            user: user,
            join_date: m.join_date,
            pending: m.pending
        }

        const expanded_user = await InspectorOsuUser.findOne({
            where: {
                user_id: m.osu_id
            }
        });

        _data.user.extra = {
            total_ss: user?.alt?.ss_count ?? 0,
            total_ssh: user?.alt?.ssh_count ?? 0,
            total_s: user?.alt?.s_count ?? 0,
            total_sh: user?.alt?.sh_count ?? 0,
            total_a: user?.alt?.a_count ?? 0,
            total_b: expanded_user?.b_count ?? 0,
            total_c: expanded_user?.c_count ?? 0,
            total_d: expanded_user?.d_count ?? 0,
            total_pp: expanded_user?.total_pp ?? 0,
            playcount: user?.alt?.playcount ?? 0,
            playtime: user?.alt?.playtime ?? 0,
            ranked_score: user?.alt?.ranked_score ?? 0,
            total_score: user?.alt?.total_score ?? 0,
            replays_watched: user?.alt?.replays_watched ?? 0,
            total_hits: user?.alt?.total_hits ?? 0,
            clears: (
                (user?.alt?.ss_count ?? 0) +
                (user?.alt?.s_count ?? 0) +
                (user?.alt?.sh_count ?? 0) +
                (user?.alt?.ssh_count ?? 0) +
                (user?.alt?.a_count ?? 0) +
                (expanded_user?.b_count ?? 0) +
                (expanded_user?.c_count ?? 0) +
                (expanded_user?.d_count ?? 0)),
            accuracy: user?.alt?.hit_accuracy ?? 0,
            level: user?.alt?.level ?? 0,
            average_pp: user?.alt?.pp ?? 0, //not really average, but easier to be picked up by the frontend,
            join_date: m.join_date
        }

        _members.push(_data);
    };

    const pending_members = _members.filter(m => m.pending == true);
    const full_members = _members.filter(m => m.pending == false);

    const owner = full_members.find(m => (m.user?.osu?.id ?? m.user?.alt?.user_id) == clan.owner) || null;

    const stats = await InspectorClanStats.findOne({
        where: {
            clan_id: clan_id
        }
    });

    //for each statistic except "clan_id", check clan position based on sorting
    const stats_keys = Object.keys(stats.dataValues);
    stats_keys.splice(stats_keys.indexOf('clan_id'), 1);

    const rankings = {};

    for (const rank of stat_rankings) {
        const sorted = await InspectorClanStats.findAll({
            order: [[rank.key, 'DESC']]
        });

        const index = sorted.findIndex(s => s.clan_id == clan_id);
        rankings[rank.key] = index + 1;
    }

    res.json({ clan: clan, stats: stats, members: full_members, owner: owner, ranking: rankings, pending_members: pending_members });
});

router.post('/update', async (req, res, next) => {
    const user_id = req.body.user.id;
    const token = req.body.user.token;

    try {
        if (!(await VerifyToken(token, user_id))) {
            res.json({ error: "Invalid token" });
            return;
        }
    } catch (error) {
        res.json({ error: "An error occurred" });
        return;
    }

    const clan_id = req.body.id;
    const clan = await InspectorClan.findOne({
        where: {
            id: clan_id
        }
    });

    if (!clan) {
        res.json({ error: "Clan not found" });
        return;
    }

    if (clan.owner != user_id) {
        res.json({ error: "You are not the owner of this clan" });
        return;
    }

    const validate = (key, value, max_length, is_url = false) => {
        //check for max length
        if (value.length > max_length) {
            res.json({ error: `${key} is too long: ${value}` });
            return false;
        }

        //check for invalid characters (unicode)
        if (!/^[\x00-\x7F]*$/.test(value)) {
            res.json({ error: `Invalid characters in ${key}: ${value}` });
            return false;
        }

        //check for invalid characters (special, if not url)
        if (!/^[\w\s]*$/.test(value) && !is_url) {
            res.json({ error: `Invalid characters in ${key}: ${value}` });
            return false;
        }

        return true;
    }

    if (!validate('name', req.body.name, 20)) return;
    if (!validate('tag', req.body.tag, 5)) return;
    if (!validate('description', req.body.description, 100)) return;
    if (!validate('color', req.body.color, 6)) return;
    if (!validate('header_image_url', req.body.header_image_url, 255, true)) return;

    const header_image_url = req.body.header_image_url;
    if (header_image_url && header_image_url.length > 0) {
        try {
            const url = new URL(header_image_url);
            if (url.protocol != "http:" && url.protocol != "https:") {
                res.json({ error: "Invalid header image url" });
                return;
            }

            //check image validity, with content-disposition:inline
            const response = await fetch(url.href, {
                method: 'HEAD'
            });

            if (response.status != 200) {
                res.json({ error: "Invalid header image url" });
                return;
            }

            //check mime type
            const content_type = response.headers.get('content-type');
            if (!content_type.startsWith("image/")) {
                res.json({ error: "Invalid header image url" });
                return;
            }

        } catch (err) {
            res.json({ error: err.message });
            return;
        }
    }

    const new_data = {
        name: req.body.name,
        tag: req.body.tag,
        description: req.body.description,
        color: req.body.color,
        header_image_url: req.body.header_image_url
    };

    for (const key in new_data) {
        clan[key] = new_data[key];
    }

    await clan.save();

    res.json({ clan: clan });
});

router.post('/delete', async (req, res, next) => {
    const user_id = req.body.user.id;
    const token = req.body.user.token;

    try {
        if (!(await VerifyToken(token, user_id))) {
            res.json({ error: "Invalid token" });
            return;
        }
    } catch (error) {
        res.json({ error: "An error occurred" });
        return;
    }

    const clan_id = req.body.id;
    const clan = await InspectorClan.findOne({
        where: {
            id: clan_id
        }
    });

    if (!clan) {
        res.json({ error: "Clan not found" });
        return;
    }

    if (clan.owner != user_id) {
        res.json({ error: "You are not the owner of this clan" });
        return;
    }

    //delete all members
    await InspectorClanMember.destroy({
        where: {
            clan_id: clan_id
        }
    });

    //delete all stats
    await InspectorClanStats.destroy({
        where: {
            clan_id: clan_id
        }
    });

    await clan.destroy();

    res.json({ success: true });
});

router.post('/join_request', async (req, res, next) => {
    const user_id = req.body.user_id;
    const token = req.body.token;
    const clan_id = req.body.clan_id;

    try {
        if (!(await VerifyToken(token, user_id))) {
            res.json({ error: "Invalid token" });
            return;
        }
    } catch (error) {
        res.json({ error: "An error occurred" });
        return;
    }

    const user = await GetInspectorUser(user_id);
    if (!user) {
        res.json({ error: "User not found" });
        return;
    }

    if (user.clan_member) {
        res.json({ error: `You are already in a clan or have a request to a clan: ${user.clan_member.clan.name}` });
        return;
    }

    const clan = await InspectorClan.findOne({
        where: {
            id: clan_id
        }
    });

    if (!clan) {
        res.json({ error: "Clan not found" });
        return;
    }

    await InspectorClanMember.create({
        osu_id: user_id,
        clan_id: clan_id,
        pending: true,
        join_date: new Date()
    });

    res.json({ success: true });
});

router.post('/accept_request', async (req, res, next) => {
    const owner_id = req.body.owner_id;
    const token = req.body.token;
    const user_id = req.body.join_request_id;
    const clan_id = req.body.clan_id;

    try {
        if (!(await VerifyToken(token, owner_id))) {
            res.json({ error: "Invalid token" });
            return;
        }
    } catch (error) {
        console.log(error);
        res.json({ error: "An error occurred" });
        return;
    }

    if (!(await IsUserClanOwner(owner_id, clan_id))) {
        res.json({ error: "You are not the owner of this clan" });
        return;
    }

    const user = await GetInspectorUser(user_id);
    if (!user) {
        res.json({ error: "User not found" });
        return;
    }

    const clan = await InspectorClan.findOne({
        where: {
            id: clan_id
        }
    });

    if (!clan) {
        res.json({ error: "Clan not found" });
        return;
    }

    //get member count
    const member_count = await InspectorClanMember.count({
        where: {
            clan_id: clan_id,
            pending: false
        }
    });

    if (member_count >= CLAN_MEMBER_LIMIT) {
        res.json({ error: `Clan member limit reached: ${CLAN_MEMBER_LIMIT}` });
        return;
    }

    const member = await InspectorClanMember.findOne({
        where: {
            osu_id: user_id,
            clan_id: clan_id,
            pending: true
        }
    });

    if (!member) {
        res.json({ error: "User is not pending to join this clan" });
        return;
    }

    member.pending = false;
    member.join_date = new Date();

    await member.save();

    res.json({ success: true });
});

router.post('/reject_request', async (req, res, next) => {
    const owner_id = req.body.owner_id;
    const token = req.body.token;
    const user_id = req.body.join_request_id;
    const clan_id = req.body.clan_id;

    try {
        if (!(await VerifyToken(token, owner_id))) {
            res.json({ error: "Invalid token" });
            return;
        }
    } catch (error) {
        res.json({ error: "An error occurred" });
        return;
    }

    if (!(await IsUserClanOwner(owner_id, clan_id))) {
        res.json({ error: "You are not the owner of this clan" });
        return;
    }

    const user = await GetInspectorUser(user_id);
    if (!user) {
        res.json({ error: "User not found" });
        return;
    }

    const clan = await InspectorClan.findOne({
        where: {
            id: clan_id
        }
    });

    if (!clan) {
        res.json({ error: "Clan not found" });
        return;
    }

    const member = await InspectorClanMember.findOne({
        where: {
            osu_id: user_id,
            clan_id: clan_id,
            pending: true
        }
    });

    if (!member) {
        res.json({ error: "User is not pending to join this clan" });
        return;
    }

    await member.destroy();

    res.json({ success: true });
});

router.post('/remove_member', async (req, res, next) => {
    const owner_id = req.body.owner_id;
    const token = req.body.token;
    const user_id = req.body.member_id;
    const clan_id = req.body.clan_id;

    try {
        if (!(await VerifyToken(token, owner_id))) {
            res.json({ error: "Invalid token" });
            return;
        }
    } catch (error) {
        res.json({ error: "An error occurred" });
        return;
    }

    if (!(await IsUserClanOwner(owner_id, clan_id))) {
        res.json({ error: "You are not the owner of this clan" });
        return;
    }

    const user = await GetInspectorUser(user_id);
    if (!user) {
        res.json({ error: "User not found" });
        return;
    }

    const clan = await InspectorClan.findOne({
        where: {
            id: clan_id
        }
    });

    if (!clan) {
        res.json({ error: "Clan not found" });
        return;
    }

    const member = await InspectorClanMember.findOne({
        where: {
            osu_id: user_id,
            clan_id: clan_id
        }
    });

    if (!member) {
        res.json({ error: "User is not in this clan" });
        return;
    }

    await member.destroy();

    res.json({ success: true });
});

router.post('/leave', async (req, res, next) => {
    const user_id = req.body.user_id;
    const token = req.body.token;
    const clan_id = req.body.clan_id;

    try {
        if (!(await VerifyToken(token, user_id))) {
            res.json({ error: "Invalid token" });
            return;
        }
    } catch (error) {
        res.json({ error: "An error occurred" });
        return;
    }

    if ((await IsUserClanOwner(user_id, clan_id))) {
        res.json({ error: "You cannot leave a clan you own" });
        return;
    }

    const user = await GetInspectorUser(user_id);
    if (!user) {
        res.json({ error: "User not found" });
        return;
    }

    if (!user.clan_member) {
        res.json({ error: "User is not in a clan" });
        return;
    }

    if (user.clan_member.clan_id != clan_id) {
        res.json({ error: "User is not in this clan" });
        return;
    }

    await user?.clan_member.destroy();

    res.json({ success: true });
});

module.exports = router;