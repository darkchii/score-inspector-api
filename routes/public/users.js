var apicache = require('apicache');
var express = require('express');
const { default: rateLimit } = require('express-rate-limit');
const { InspectorUser } = require('../../helpers/db');
const { getFullUsers } = require('../../helpers/inspector');
var router = express.Router();

const limiter = rateLimit({
    windowMs: 60 * 1000, // 15 minutes
    max: 60, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

let cache = apicache.middleware;

router.get('/:id', limiter, cache('10 minutes'), async function (req, res, next) {
    const id = req.params.id;
    let osu_id = null;
    if(id==='me'){
        const api_key = req.api_key;
    
        const owner = await InspectorUser.findOne({
            where: { api_key: api_key },
        });
    
        if(!owner){
            res.status(401).json({ error: 'Something went wrong somehow' });
            return;
        }

        osu_id = owner.osu_id;
    }else{
        osu_id = id;
    }

    try{
        const user = (await getFullUsers([osu_id]))[0];
        res.json(user);
    }catch(err){
        res.status(500).json({ error: 'Unable to get user', message: err.message });
    }
});

module.exports = router;
