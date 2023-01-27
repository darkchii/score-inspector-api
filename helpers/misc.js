module.exports.parse = parse;
function parse(str) {
    var args = [].slice.call(arguments, 1),
        i = 0;

    return str.replace(/%s/g, () => args[i++]);
}

module.exports.range = range;
function range(size, startAt = 0) {
    return [...Array(size).keys()].map(i => i + startAt);
}

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

module.exports.CorrectedSqlScoreMods = `(CAST("Score"."enabled_mods" AS int))& ~${excluded_mods.reduce((ps, a) => ps + a, 0)}`;