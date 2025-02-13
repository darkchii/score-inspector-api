const { DataTypes } = require("@sequelize/core");

const InspectorTokenModel = (db) => db.define('Token', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    token: { type: DataTypes.STRING, allowNull: false, },
    osu_id: { type: DataTypes.INTEGER, allowNull: false, },
    date_created: { type: DataTypes.DATE, allowNull: false, },
}, {
    tableName: 'inspector_tokens',
    timestamps: false
});
module.exports.InspectorTokenModel = InspectorTokenModel;