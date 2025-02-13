const { DataTypes } = require("@sequelize/core");

const AltUniqueSSModel = (db) => db.define('UniqueSS', {
    beatmap_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    user_id: { type: DataTypes.INTEGER },
}, {
    tableName: 'unique_ss',
    timestamps: false,
});
module.exports.AltUniqueSSModel = AltUniqueSSModel;