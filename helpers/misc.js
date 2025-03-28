const { default: axios } = require('axios');
var cors = require('cors');
var validator = require('validator');

module.exports.parse = parse;
function parse(str) {
    var args = [].slice.call(arguments, 1),
        i = 0;

    return str.replace(/%s/g, () => args[i++]);
}

const db_now = "timezone('utc', now())";
module.exports.db_now = db_now;

module.exports.range = range;
function range(size, startAt = 0) {
    return [...Array(size).keys()].map(i => i + startAt);
}

const all_mods = {
    None: 0,
    NoFail: 1,
    Easy: 2,
    TouchDevice: 4,
    Hidden: 8,
    HardRock: 16,
    SuddenDeath: 32,
    DoubleTime: 64,
    Relax: 128,
    HalfTime: 256,
    Nightcore: 512, // Only set along with DoubleTime. i.e: NC only gives 576
    Flashlight: 1024,
    Autoplay: 2048,
    SpunOut: 4096,
    Relax2: 8192,    // Autopilot
    Perfect: 16384, // Only set along with SuddenDeath. i.e: PF only gives 16416  
    Key4: 32768,
    Key5: 65536,
    Key6: 131072,
    Key7: 262144,
    Key8: 524288,
    FadeIn: 1048576,
    Random: 2097152,
    Cinema: 4194304,
    Target: 8388608,
    Key9: 16777216,
    KeyCoop: 33554432,
    Key1: 67108864,
    Key3: 134217728,
    Key2: 268435456,
    ScoreV2: 536870912,
    Mirror: 1073741824,
}

module.exports.all_mods_short = {
    NM: 0,
    NF: 1,
    EZ: 2,
    TD: 4,
    HD: 8,
    HR: 16,
    SD: 32,
    DT: 64,
    RX: 128,
    HT: 256,
    NC: 512, // Only set along with DoubleTime. i.e: NC only gives 576
    FL: 1024,
    AP: 2048,
    SO: 4096,
    RX2: 8192,    // Autopilot
    PF: 16384, // Only set along with SuddenDeath. i.e: PF only gives 16416  
    SV2: 536870912,
}

//these are difficulty adjusting mods
const include_mods = [
    2, //EZ
    16, //HR
    64, //DT
    256, //HT
    512, //NC
    1024, //FL
];

module.exports.mod_multipliers = {
    [all_mods.None]: 1,
    [all_mods.Easy]: 0.5,
    [all_mods.NoFail]: 0.5,
    [all_mods.HalfTime]: 0.3,
    [all_mods.HardRock]: 1.06,
    [all_mods.DoubleTime]: 1.12,
    [all_mods.Hidden]: 1.06,
    [all_mods.Flashlight]: 1.12,
    [all_mods.SpunOut]: 0.9,
}

module.exports.GetModMultiplier = (enabled_mods) => {
    let multiplier = 1;
    for (let mod in module.exports.mod_multipliers) {
        if (enabled_mods & mod) {
            multiplier *= module.exports.mod_multipliers[mod];
        }
    }
    return multiplier;
}

const included_mods_score = [
    all_mods.None,
    all_mods.Easy,
    all_mods.NoFail,
    all_mods.HalfTime,
    all_mods.HardRock,
    all_mods.DoubleTime,
    all_mods.Hidden,
    all_mods.Flashlight,
    all_mods.SpunOut,
];
module.exports.included_mods_score = included_mods_score;

const excluded_mods = [
    1, //NF
    8, //HD
    32, //SD
    128, //RX
    512, //NC
    2048, //AP
    4096, //SO
    16384, //PF
    8192, //RX2
    536870912, //SV2
    1073741824, //Mirror
];
module.exports.excluded_mods = excluded_mods;


module.exports.CorrectMod = (enabled_mods) => {
    return enabled_mods & ~excluded_mods.reduce((ps, a) => ps + a, 0);
}

module.exports.CorrectModScore = (enabled_mods) => {
    // return enabled_mods & ~excluded_mods_score.reduce((ps, a) => ps + a, 0);
    // only return mods that are in included_mods_score
    return enabled_mods & included_mods_score.reduce((ps, a) => ps + a, 0);
}

module.exports.ModsToString = (enabled_mods) => {
    let mods = [];
    for (let mod in all_mods_short) {
        if (enabled_mods & all_mods_short[mod]) {
            mods.push(mod);
        }
    }
    return mods.join('');
}

module.exports.CorrectedSqlScoreMods = `(CAST("Score"."enabled_mods" AS int))& ~${excluded_mods.reduce((ps, a) => ps + a, 0)}`;
module.exports.CorrectedSqlScoreMods_2 = `(CAST(scores.enabled_mods AS int))& ~${excluded_mods.reduce((ps, a) => ps + a, 0)}`;
module.exports.CorrectedSqlScoreModsCustom = (enabled_mods) => `${enabled_mods}& ~${excluded_mods.reduce((ps, a) => ps + a, 0)}`;

module.exports.sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.renameKey = function (obj, curKey, newKey) {
    if (curKey !== newKey) {
        obj[newKey] = obj[curKey];
        delete obj[curKey];
    }

    return obj;
}

module.exports.validateString = function (key, value, max_length = 255, can_be_empty = false, is_url = false) {

    if (typeof value !== 'string') {
        throw new Error(`Invalid type for ${key}: ${value}`);
    }

    if (value.length > max_length) {
        throw new Error(`${key} is too long: ${value}`);
    }

    if (!can_be_empty && value.length < 1) {
        throw new Error(`${key} cannot be empty`);
    }

    if (value.length > 0 && !validator.isAscii(value)) {
        throw new Error(`Invalid characters in ${key}: ${value}`);
    }

    if (is_url && !validator.isURL(value) && value.length > 0) {
        throw new Error(`Invalid URL in ${key}: ${value}`);
    }

    return true;
}

module.exports.getDataImageFromUrl = async function (url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        const mimeType = response.headers['content-type'];
        const dataString = `data:${mimeType};base64,${buffer.toString('base64')}`;
        return dataString;
    } catch (error) {
        console.error('Error fetching image:', error);
        return null;
    }
}

module.exports.validateImageUrl = async function (image_url) {
    const url = new URL(image_url);
    if (url.protocol != "http:" && url.protocol != "https:") {
        // res.json({ error: "Invalid header image url" });
        throw new Error("Invalid image url");
    }

    //check image validity, with content-disposition:inline
    const response = await fetch(url.href, {
        method: 'HEAD'
    });

    if (response.status != 200) {
        // res.json({ error: "Invalid header image url" });
        throw new Error("Invalid image url");
    }

    //check mime type
    const content_type = response.headers.get('content-type');
    if (!content_type.startsWith("image/")) {
        // res.json({ error: "Invalid header image url" });
        throw new Error("Invalid image url");
    }

    return true;
}