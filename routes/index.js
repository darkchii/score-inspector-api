var cors = require('cors');

var privateAdminRoute = require('./private/admin');
var privateBeatmapsRoute = require('./private/beatmaps');
var privateLeaderboardsRoute = require('./private/leaderboards');
var privateLoginRoute = require('./private/login');
var privateMedalsRoute = require('./private/medals');
var privateScoresRoute = require('./private/scores');
var privateSystemRoute = require('./private/system');
var privateUsersRoute = require('./private/users');
var privateIndexRoute = require('./private/index');

var publicUsersRoute = require('./public/users');
const { validateApiKey } = require('../helpers/inspector');

let privateRoutes = [
    {
        path: '/admin',
        route: privateAdminRoute
    }, {
        path: '/beatmaps',
        route: privateBeatmapsRoute
    }, {
        path: '/leaderboards',
        route: privateLeaderboardsRoute
    }, {
        path: '/login',
        route: privateLoginRoute
    }, {
        path: '/medals',
        route: privateMedalsRoute
    }, {
        path: '/scores',
        route: privateScoresRoute
    }, {
        path: '/system',
        route: privateSystemRoute
    }, {
        path: '/users',
        route: privateUsersRoute
    }, {
        path: '/',
        route: privateIndexRoute
    }
];

let publicRoutes = [
    {
        path: '/public/users',
        route: publicUsersRoute
    }
];

let cors_whitelist = ['https://score.kirino.sh', 'https://beta.score.kirino.sh'];
if(process.env.NODE_ENV !== 'production'){
    cors_whitelist.push('http://localhost:3006');
}
module.exports.ApplyRoutes = ApplyRoutes;
function ApplyRoutes(app) {
    privateRoutes.forEach(route => {
        if (route.path !== '/') {
            app.use(route.path, cors({
                origin: (origin, callback) => {
                    if (cors_whitelist.indexOf(origin) !== -1) {
                        callback(null, true)
                    } else {
                        callback(new Error('Not allowed by CORS'))
                    }
                }
            }));
        }
        app.use(route.path, route.route);
    });

    publicRoutes.forEach(route => {
        app.use(route.path, async function(req, res, next){
            //check both query and header, prioritize header
            let api_key = req.headers['x-api-key'];
            if (!api_key) {
                api_key = req.query.key;
            }

            if (!api_key) {
                res.status(401).json({ error: 'No API key provided. Use \'key\' parameter in url or \'x-api-key\' header' });
                return;
            }

            const is_valid = await validateApiKey(api_key);

            if (!is_valid) {
                res.status(401).json({ error: 'Invalid API key provided' });
                return;
            }

            req.api_key = api_key;
            next();
        })
        app.use(route.path, route.route);
    });
}
