const { DataTypes } = require("@sequelize/core");

const InspectorCountryStatModel = (db) => db.define('CountryStat', {
    country_code: { type: DataTypes.STRING(2), primaryKey: true, },
    stat: { type: DataTypes.STRING(32), primaryKey: true, },
    value: { type: DataTypes.INTEGER, allowNull: false, }
}, {
    tableName: 'inspector_population_stats',
    timestamps: false
});
module.exports.InspectorCountryStatModel = InspectorCountryStatModel;