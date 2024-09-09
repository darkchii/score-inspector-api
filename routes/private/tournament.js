const express = require('express');
const router = express.Router();
require('dotenv').config();
const { Tournament } = require('../../helpers/db');

router.get('/list', async (req, res, next) => {
    try {
        const tournaments = await Tournament.findAll();

        //seperate by tournament_type
        const tournament_types = {};
        tournaments.forEach((tournament) => {
            if (!tournament_types[tournament.tournament_type]) {
                tournament_types[tournament.tournament_type] = [];
            }
            tournament_types[tournament.tournament_type].push(tournament);
        });
        res.json({ tournaments: tournament_types });
    } catch (err) {
        res.json({ error: err.message });
    }
});

router.get('/get/:id', async (req, res, next) => {
    try {
        const tournament = await Tournament.findOne({ where: { id: req.params.id } });

        if (!tournament) {
            res.json({ error: 'Tournament not found' });
            return;
        }

        res.json({ tournament: tournament });
    } catch (err) {
        res.json({ error: err.message });
    }
}
);

module.exports = router;