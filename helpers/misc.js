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
