const { Sequelize, Op } = require("sequelize");
const { AltBeatmap } = require("../helpers/db");
const { getCurrentPoll, createNewPoll, updateMapPoll } = require("../helpers/mappoll");

const cacher = {
    func: UpdateMapPoll,
    name: 'UpdateMapPoll',
}

module.exports = cacher;

async function UpdateMapPoll() {
    await updateMapPoll();
}
