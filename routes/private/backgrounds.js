const { default: axios } = require('axios');
const express = require('express');
const router = express.Router();
require('dotenv').config();
const { InspectorUser, InspectorRole, InspectorOsuUser, InspectorClanMember, InspectorClan, InspectorBackgroundSource, InspectorBackgroundTag, AltBeatmap } = require('../../helpers/db');
const { VerifyToken, GetInspectorUser } = require('../../helpers/inspector');
const { GetBeatmaps } = require('../../helpers/osu');
const { Op } = require('@sequelize/core');

async function HasEditAccess(user_id, session_token) {
    if (session_token == null || user_id == null) {
        throw new Error('Invalid data');
    }

    const valid_token = await VerifyToken(session_token, user_id);

    if (!valid_token) {
        throw new Error('Invalid token');
    }

    const user = await GetInspectorUser(user_id);

    if (user == null) {
        throw new Error('Invalid user');
    }

    //check if any of the roles are admin
    const admin_roles = user.roles.filter((role) => role.is_admin === true);

    if (admin_roles.length === 0) {
        throw new Error('No permission');
    }

    return true;
}

router.get('/stats', async (req, res, next) => {
    try{
        const sourced = await InspectorBackgroundSource.count();
        const tags = await InspectorBackgroundTag.count();

        res.json({
            sourced: sourced,
            tags: tags,
        });
    }catch(err){
        res.json({error: err.message });
    }
});

router.get('/find/:query', async (req, res, next) => {
    try{
        //expected json string query
        const input = JSON.parse(req.params.query);

        const search_query = {
            general: input.query, //basic beatmap search (title, artist, creator), sql
            tags: input.tags, //tag search, sql
            tags_mode: input.tags_mode, //"AND" or "OR"
            artist: input.artist, //background artist
        }

        const beatmaps = await AltBeatmap.findAll({
            // where: {
            //     //always lowercase, trim and LIKE
            //     title: { [Op.iLike]: `%${search_query.general.toLowerCase().trim()}%` },
            //     artist: { [Op.iLike]: `%${search_query.general.toLowerCase().trim()}%` },
            //     creator: { [Op.iLike]: `%${search_query.general.toLowerCase().trim()}%` },
            // },
            //OR
            where: {
                [Op.or]: [
                    { title: { [Op.iLike]: `%${search_query.general.toLowerCase().trim()}%` } },
                    { artist: { [Op.iLike]: `%${search_query.general.toLowerCase().trim()}%` } },
                    { creator: { [Op.iLike]: `%${search_query.general.toLowerCase().trim()}%` } },
                ],
            },
            limit: 50,
        });

        if(beatmaps.length === 0){
            res.json({error: "No beatmaps found"});
            return;
        }

        //map beatmap_ids
        const beatmap_ids = beatmaps.map(beatmap => beatmap.beatmap_id);

        const _actual_beatmaps = await GetBeatmaps(beatmap_ids);

        res.json({beatmaps: _actual_beatmaps?.beatmaps});
    }catch(err){
        res.json({error: err.message });
    }
});

module.exports = router;