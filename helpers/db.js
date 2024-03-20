const { Sequelize } = require('sequelize');
const { modelAltBeatmap } = require('./models/modelAltBeatmap');

require('dotenv').config();

let databases = {
    inspector: new Sequelize(process.env.MYSQL_DB, process.env.MYSQL_USER, process.env.MYSQL_PASS, { host: process.env.MYSQL_HOST, dialect: 'mariadb', timezone: 'Europe/Amsterdam', logging: false }),
    osuAlt: new Sequelize(process.env.ALT_DB_DATABASE, process.env.ALT_DB_USER, process.env.ALT_DB_PASSWORD, { host: process.env.ALT_DB_HOST, dialect: 'postgres', logging: false })
};
module.exports.Databases = databases;

let models = {
    altBeatmap: modelAltBeatmap(databases.osuAlt)
};

module.exports.Models = models;