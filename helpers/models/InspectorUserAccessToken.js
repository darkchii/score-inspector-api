const { Sequelize } = require("sequelize");

const InspectorUserAccessTokenModel = (db) => db.define('AccessToken', {
    user_id: { type: Sequelize.INTEGER, primaryKey: true },
    osu_id: { type: Sequelize.INTEGER, allowNull: false, },
    access_token: { type: Sequelize.STRING, allowNull: false, },
    refresh_token: { type: Sequelize.STRING, allowNull: false, },
    expires_in: { type: Sequelize.INTEGER, allowNull: false, },
    created_at: { type: Sequelize.DATE, allowNull: false, },
}, {
    tableName: 'inspector_user_accesstoken',
    timestamps: false
});
module.exports.InspectorUserAccessTokenModel = InspectorUserAccessTokenModel;