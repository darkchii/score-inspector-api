const { Sequelize } = require("sequelize");

const AltUniqueSSModel = (db) => db.define('UniqueSS', {
    beatmap_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    user_id: { type: Sequelize.INTEGER },
}, {
    tableName: 'unique_ss',
    timestamps: false,
});
module.exports.AltUniqueSSModel = AltUniqueSSModel;