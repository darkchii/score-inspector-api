const { Sequelize } = require("sequelize");

const AltUniqueFCModel = (db) => db.define('UniqueFC', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    user_id: { type: Sequelize.INTEGER },
}, {
    tableName: 'unique_fc',
    timestamps: false,
});
module.exports.AltUniqueFCModel = AltUniqueFCModel;