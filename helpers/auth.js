require('dotenv').config();

async function checkAuth(req) {
    //just a check if we need to ratelimit or limit amount of db results

    //checks if API key/auth token is used, or if request is from our own frontend
    //if not, return false

    let authenticated = false;

    //check if request is from our own frontend
    const whitelist = process.env.WHITELIST_WEB.split(", ");
    if (whitelist.includes(req.headers.origin)) {
        authenticated = true;
    }

    if(!authenticated){
        console.log("Not authenticated, possible rate limit will be applied.");
    }

    return authenticated;
}

module.exports = {
    checkAuth
};