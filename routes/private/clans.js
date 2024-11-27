const express = require('express');
const { VerifyToken, getFullUsers, GetInspectorUser } = require('../../helpers/inspector');
const { InspectorClanMember, InspectorClan, InspectorClanStats, AltScore, InspectorOsuUser, InspectorUser, InspectorUserRole, InspectorClanLogs, InspectorClanRanking } = require('../../helpers/db');
const { Op } = require('sequelize');
const { IsUserClanOwner } = require('../../helpers/clans');
const { validateString } = require('../../helpers/misc');
const router = express.Router();
require('dotenv').config();

const CLAN_MEMBER_LIMIT = 100;
const CLAN_MEMBER_LIMIT_PREMIUM = 150;

const stat_rankings = [
    { key: 'clears', query: 'clears' },
    { key: 'total_ss', query: 'total_ssh+total_ss' },
    { key: 'total_ss_both', query: 'total_ss_both' },
    { key: 'total_s', query: 'total_sh+total_s' },
    { key: 'total_s_both', query: 'total_s_both' },
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
    { key: 'accuracy', query: 'accuracy' },
    { key: 'members', query: 'members' },
    { key: 'medals', query: 'medals' },
    { key: 'badges', query: 'badges' }
]

router.get('/list', async (req, res, next) => {
    const page = req.query.page || 1;
    let limit = req.query.limit || 1000;
    let sort = req.query.sort || 'clan_id';
    let order = req.query.order || 'DESC';
    let search = req.query.search || null;
    if (!page) {
        limit = 1000;
    }

    limit = parseInt(limit)
    limit = Math.min(limit, 1000);
    limit = Math.max(limit, 1);

    switch (sort) {
        case 'level':
            sort = 'total_score';
            break;
        case 'total_ss':
            sort = 'total_ss_both';
            break;
        case 'total_s':
            sort = 'total_s_both';
            break;
        default:
            break;
    }

    let offset = (page - 1) * limit;

    let search_query = undefined;
    if (search) {
        search = search.replace(/[^a-zA-Z0-9\s]/g, '');
        search_query = {
            [Op.or]: [
                { name: { [Op.like]: `%${search}%` } },
                { tag: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
            ]
        }
    }

    const clans = await InspectorClan.findAll({
        where: search_query,
        order: [
            [{ model: InspectorClanStats, as: 'clan_stats' }, sort, order]
        ],
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
        ]
    });

    let sliced_clans = clans.slice(offset, offset + limit);

    const total_clans = await InspectorClan.count();
    const total_members = await InspectorClanMember.count({
        where: {
            pending: false
        }
    });

    sliced_clans = sliced_clans.map(c => c.dataValues);

    //add owner_user to each clan
    for await (const clan of sliced_clans) {
        const owner = await GetInspectorUser(clan.owner);
        clan.owner_user = owner;
    }

    res.json({
        clans: sliced_clans,
        query_clans: clans.length,
        total_clans: total_clans,
        total_members: total_members
    });
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

    //check if the clan name or tag is already taken
    const tag_taken = await InspectorClan.findOne({
        where: {
            tag: req.body.tag,
        }
    });

    if (tag_taken) {
        res.json({ error: "Clan tag is already taken" });
        return;
    }

    const clan_name_taken = await InspectorClan.findOne({
        where: {
            name: req.body.name,
        }
    });

    if (clan_name_taken) {
        res.json({ error: "Clan name or tag is already taken" });
        return;
    }

    try {
        validateString('name', clan_name, 20);
        validateString('tag', clan_tag, 5);
        validateString('description', req.body.description, 100);
        validateString('color', req.body.color, 6);
    } catch (err) {
        res.json({ error: err.message });
        return;
    }

    const new_clan = await InspectorClan.create({
        name: clan_name,
        tag: clan_tag,
        owner: user_id,
        description: req.body.description,
        color: req.body.color,
        disable_requests: false,
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

    try {
        InspectorClanLogs.create({
            clan_id: new_clan.id,
            created_at: new Date(),
            data: JSON.stringify({
                type: 'clan_create',
            })
        });
    } catch (err) {
        //do nothing, this isnt critical to work
    }

    res.json({ clan: new_clan, member: new_member, stats: new_stats });
});

//this is a temporary cache for user data
//it will be used to reduce the amount of requests to the database
//max 1 hour
const user_local_cache = {};
const USER_CACHE_TIME = 900000; //10 minutes
router.all('/user/:id?', async (req, res, next) => {
    //can be one or multiple ids, separated by commas
    // let ids = req.params.id.split(',');
    let ids = [];

    if (req.params.id) {
        ids = req.params.id.split(',');
    } else if (req.body.ids) {
        ids = req.body.ids;
    } else {
        res.status(400).json({ error: "Invalid user id" });
        return;
    }

    //check cache
    const now = new Date();
    let fetched_cached_data = [];
    //grab cached data for each id if its still valid and exists
    for (const id of ids) {
        if (user_local_cache[id] && user_local_cache[id].expires > now) {
            fetched_cached_data.push(user_local_cache[id].data);
        }
    }

    //clean up cache for expired data
    for (const data of Object.keys(user_local_cache)) {
        if (user_local_cache[data].expires < now) {
            delete user_local_cache[data];
        }
    }

    //only numbers are allowed
    ids = ids.filter(id => !isNaN(id));

    //dont fetch users that are in fetched_cached_data (fetched_cached_data.data.osu_id)
    ids = ids.filter(id => !fetched_cached_data.find(d => d.osu_id == id));

    if (ids.length == 0 && fetched_cached_data.length == 0) {
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

    //put the data in the cache if it doesn't exist
    for (const member of members) {
        if (!user_local_cache[member.osu_id]) {
            user_local_cache[member.osu_id] = {
                data: member,
                expires: new Date(now.getTime() + USER_CACHE_TIME)
            };
        }
    }

    const merged_data = fetched_cached_data.concat(members || []);

    if (merged_data.length == 0) {
        res.status(404).json({ error: "No data found" });
        return;
    }

    res.json(merged_data);
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

    if (allow_pending) {
        allow_pending = clan.owner == login_user_id;
    }

    const members = await InspectorClanMember.findAll({
        where: {
            clan_id: clan_id,
            pending: allow_pending ? { [Op.or]: [true, false] } : false
        }
    });

    //get full user info for each member
    const ids = members.map(m => m.osu_id);
    let full_users = await getFullUsers(ids, { daily: true, alt: false, score: true, osu: true }, true, true);

    //for those missing "alt" data, we need to fetch it separately with osu: false
    //use "ids" to get the missing users, then merge them with the full_users array
    const missing_ids = ids.filter(id => !full_users.find(u => u.alt?.user_id == id));
    if (missing_ids.length > 0) {
        let missing_users = await getFullUsers(missing_ids, { daily: true, alt: true, score: true, osu: false }, true, true);

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
            total_ss_both: (user?.alt?.ss_count ?? 0) + (user?.alt?.ssh_count ?? 0),
            total_s: user?.alt?.s_count ?? 0,
            total_sh: user?.alt?.sh_count ?? 0,
            total_s_both: (user?.alt?.s_count ?? 0) + (user?.alt?.sh_count ?? 0),
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
            join_date: m.join_date,
            medals: user?.alt?.medals ?? 0,
            badges: user?.alt?.badges ?? 0
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

    const logs = await InspectorClanLogs.findAll({
        where: {
            clan_id: clan_id
        },
        order: [
            ['created_at', 'DESC']
        ],
        limit: 50
    });

    //find every possible user_id in the logs, we need to fetch their data
    let log_ids = [];
    for (const log of logs) {
        const data = JSON.parse(log.data);
        if (data.user_id) { log_ids.push(data.user_id); }
        if (data.owner_id) { log_ids.push(data.owner_id); }
        if (data.new_owner) { log_ids.push(data.new_owner); }
        if (data.member_id) { log_ids.push(data.member_id); }
        if (data.old_owner) { log_ids.push(data.old_owner); }
    }

    //remove duplicates
    log_ids = [...new Set(log_ids)];

    //only need inspector user data for them, no need for full user data
    const log_users = await InspectorUser.findAll({
        where: {
            osu_id: log_ids
        }
    });

    res.json({ clan: clan, stats: stats, members: full_members, owner: owner, ranking: rankings, pending_members: pending_members, logs: logs, logs_user_data: log_users });
});

router.post('/update', async (req, res, next) => {
    try {


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

        try {
            validateString('name', req.body.name, 20);
            validateString('tag', req.body.tag, 5);
            validateString('description', req.body.description, 100);
            validateString('color', req.body.color, 6);
            validateString('header_image_url', req.body.header_image_url, 255, true, true);
            validateString('default_sort', req.body.default_sort, 32);
            validateString('discord_invite', req.body.discord_invite, 255, true, true);
        } catch (err) {
            res.json({ error: err.message });
            return;
        }

        //check if req.body.enable_requests is a boolean
        if (typeof req.body.disable_requests !== "boolean") {
            res.json({ error: "Invalid disable_requests value" });
            return;
        }

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

        //discord invite validation
        let discord_invite = req.body.discord_invite;
        if (discord_invite && discord_invite.length > 0) {
            //get the invite code
            const invite_code = discord_invite.split('/').pop();

            //check if the invite code is valid
            const response = await fetch(`https://discord.com/api/v9/invites/${invite_code}`);

            if (response.status != 200) {
                res.json({ error: "Invalid discord invite" });
                return;
            }

            discord_invite = `https://discord.gg/${invite_code}`;
        }

        //check if the clan name or tag is already taken
        const tag_taken = await InspectorClan.findOne({
            where: {
                tag: req.body.tag,
                id: { [Op.ne]: clan_id }
            }
        });

        if (tag_taken) {
            res.json({ error: "Clan tag is already taken" });
            return;
        }

        const clan_name_taken = await InspectorClan.findOne({
            where: {
                name: req.body.name,
                id: { [Op.ne]: clan_id }
            }
        });

        if (clan_name_taken) {
            res.json({ error: "Clan name or tag is already taken" });
            return;
        }

        const old_data = JSON.stringify(clan.dataValues);

        const new_data = {
            name: req.body.name,
            tag: req.body.tag,
            description: req.body.description,
            color: req.body.color,
            header_image_url: req.body.header_image_url,
            disable_requests: req.body.disable_requests,
            default_sort: req.body.default_sort,
            discord_invite: discord_invite
        };

        for (const key in new_data) {
            clan[key] = new_data[key];
        }

        await clan.save();

        try {
            await InspectorClanLogs.create({
                clan_id: clan_id,
                created_at: new Date(),
                data: JSON.stringify({
                    type: 'clan_update',
                    old_data: old_data,
                    new_data: JSON.stringify(new_data)
                })
            });
        } catch (err) {
            //do nothing, this isnt critical to work
        }

        res.json({ clan: clan });
    } catch (err) {
        res.json({ error: "An error occurred" });
    }
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

    if (clan.disable_requests) {
        res.json({ error: "Clan does not accept join requests" });
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
        res.json({ error: "User not found, this is most likely a bug." });
        return;
    }

    const owner = await GetInspectorUser(owner_id);
    if (!owner) {
        res.json({ error: "Owner not found, this is most likely a bug." });
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

    const is_owner_premium = (await InspectorUserRole.findOne({
        where: {
            user_id: owner.id,
            role_id: 4
        }
    }))?.dataValues?.user_id === owner.id;

    if (member_count >= (is_owner_premium ? CLAN_MEMBER_LIMIT_PREMIUM : CLAN_MEMBER_LIMIT)) {
        // res.json({ error: `Clan member limit reached: ${is_owner_premium ? CLAN_MEMBER_LIMIT_PREMIUM : CLAN_MEMBER_LIMIT}` });
        if (!is_owner_premium) {
            res.json({ error: `Clan member limit reached: ${CLAN_MEMBER_LIMIT}, donator owners has a limit of ${CLAN_MEMBER_LIMIT_PREMIUM}` });
        } else {
            res.json({ error: `Clan member limit reached: ${CLAN_MEMBER_LIMIT_PREMIUM}` });
        }
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

    try {
        await InspectorClanLogs.create({
            clan_id: clan_id,
            created_at: new Date(),
            data: JSON.stringify({
                type: 'member_join',
                user_id: user_id
            })
        });
    } catch (err) {
        //do nothing, this isnt critical to work
    }

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

    try {

        await InspectorClanLogs.create({
            clan_id: clan_id,
            created_at: new Date(),
            data: JSON.stringify({
                type: 'member_remove',
                owner_id: owner_id,
                user_id: user_id
            })
        });
    } catch (err) {
        //do nothing, this isnt critical to work
    }

    res.json({ success: true });
});

router.post('/transfer_owner', async (req, res, next) => {
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

    if (clan.last_owner_change) {
        const last_change = new Date(clan.last_owner_change);
        const now = new Date();

        if (last_change.getTime() + 2592000000 > now.getTime()) {
            const valid_date = new Date(last_change.getTime() + 2592000000);
            const valid_date_pretty = valid_date.toUTCString();
            res.json({ error: `Clan owner transfer cooldown is active, wait until: ${valid_date_pretty}` });
            return;
        }
    }

    clan.owner = user_id;
    clan.last_owner_change = new Date();
    await clan.save();

    try {
        await InspectorClanLogs.create({
            clan_id: clan_id,
            created_at: new Date(),
            data: JSON.stringify({
                type: 'owner_transfer',
                old_owner: owner_id,
                new_owner: user_id
            })
        });
    } catch (err) {
        //do nothing, this isnt critical to work
    }

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

router.get('/rankings/months', async (req, res, next) => {
    //get all clan ranking months that are available
    const months = await InspectorClanRanking.findAll({
        attributes: ['date']
    });

    //return as array
    res.json(months.map(m => m.date));
});

router.get('/rankings/:date?', async (req, res, next) => {
    //month is month or current month (utc)
    try {
        let _date = req.params.date;
        if (!_date) {
            const __date = new Date();
            let month = __date.getUTCMonth() + 1;
            if (month < 10) {
                month = `0${month}`;
            }
            _date = `${__date.getUTCFullYear()}-${month}`;
        }

        console.log(_date);

        const data = await InspectorClanRanking.findOne({
            where: {
                date: _date
            }
        });

        if (!data) {
            res.json({ error: "Data not found" });
            return;
        }

        const parsed_data = JSON.parse(data.data);

        // parsed_data.top_play
        for await (const clan of parsed_data.top_play) {
            const score = clan.ranking_prepared.top_play;
            const user = await GetInspectorUser(score.user_id);
            score.user = user;
        }

        for await (const clan of parsed_data.top_score) {
            const score = clan.ranking_prepared.top_score;
            const user = await GetInspectorUser(score.user_id);
            score.user = user;
        }

        // console.log(parsed_data.total_scores[0].owner);
        //we need to fetch user data for each clan owner
        for await(const stat of Object.keys(parsed_data)) {
            const stat_obj = parsed_data[stat];
            if(stat_obj && Array.isArray(stat_obj)){
                for await(const clan of stat_obj) {
                    const user = await GetInspectorUser(clan.owner);
                    clan.owner_user = user;
                }
            }
        }

        res.json({
            data: parsed_data,
            date: data.date
        });
    } catch (err) {
        res.json({ error: err.message });
        return
    }
});

module.exports = router;