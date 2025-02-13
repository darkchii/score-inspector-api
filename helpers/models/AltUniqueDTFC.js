const { DataTypes } = require("@sequelize/core");

const AltUniqueDTFCModel = (db) => db.define('UniqueDTFC', {
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    user_id: { type: DataTypes.INTEGER },
}, {
    tableName: 'unique_dt_fc',
    timestamps: false,
});
module.exports.AltUniqueDTFCModel = AltUniqueDTFCModel;