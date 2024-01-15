const { Sequelize } = require("sequelize");

const InspectorCountryStatModel = (db) => db.define('CountryStat', {
    country_code: { type: Sequelize.STRING(2), primaryKey: true, },
    stat: { type: Sequelize.STRING(32), primaryKey: true, },
    value: { type: Sequelize.INTEGER, allowNull: false, }
}, {
    tableName: 'inspector_population_stats',
    timestamps: false
});
module.exports.InspectorCountryStatModel = InspectorCountryStatModel;