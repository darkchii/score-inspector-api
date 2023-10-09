var apicache = require('apicache');
var express = require('express');
const { default: rateLimit } = require('express-rate-limit');
var router = express.Router();

const limiter = rateLimit({
    windowMs: 60 * 1000, // 15 minutes
    max: 60, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

let cache = apicache.middleware;

router.get('/:id', limiter, cache('10 minutes'), async function (req, res, next) {
    res.json({ test: 'test' })
});

module.exports = router;
