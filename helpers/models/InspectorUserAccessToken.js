const { DataTypes } = require("@sequelize/core");

const InspectorUserAccessTokenModel = (db) => db.define('AccessToken', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true },
    osu_id: { type: DataTypes.INTEGER, allowNull: false, },
    access_token: { type: DataTypes.STRING, allowNull: false, },
    refresh_token: { type: DataTypes.STRING, allowNull: false, },
    expires_in: { type: DataTypes.INTEGER, allowNull: false, },
    created_at: { type: DataTypes.DATE, allowNull: false, },
}, {
    tableName: 'inspector_user_accesstoken',
    timestamps: false
});
module.exports.InspectorUserAccessTokenModel = InspectorUserAccessTokenModel;