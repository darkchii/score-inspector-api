var cors = require('cors');

module.exports.parse = parse;
function parse(str) {
    var args = [].slice.call(arguments, 1),
        i = 0;

    return str.replace(/%s/g, () => args[i++]);
}

const db_now = "timezone('UTC'::text, now())";
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

const all_mods_short = {
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
module.exports.CorrectedSqlScoreModsCustom = (enabled_mods) => `${enabled_mods}& ~${excluded_mods.reduce((ps, a) => ps + a, 0)}`;

module.exports.sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.renameKey = function (obj, curKey, newKey) {
    if(curKey !== newKey){
        obj[newKey] = obj[curKey];
        delete obj[curKey];
    }

    return obj;
}