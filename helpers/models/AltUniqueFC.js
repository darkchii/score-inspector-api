const { DataTypes } = require("@sequelize/core");

const AltUniqueFCModel = (db) => db.define('UniqueFC', {
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    user_id: { type: DataTypes.INTEGER },
}, {
    tableName: 'unique_fc',
    timestamps: false,
});
module.exports.AltUniqueFCModel = AltUniqueFCModel;