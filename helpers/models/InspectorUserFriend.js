const { Sequelize } = require("sequelize");

const InspectorUserFriendModel = (db) => db.define('UserFriend', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    primary_osu_id: { type: Sequelize.INTEGER, allowNull: false, },
    friend_osu_id: { type: Sequelize.INTEGER, allowNull: false, },
    friend_username: { type: Sequelize.STRING, allowNull: false, },
}, {
    tableName: 'inspector_user_friends',
    timestamps: false
});
module.exports.InspectorUserFriendModel = InspectorUserFriendModel;