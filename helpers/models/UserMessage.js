const { DataTypes } = require("@sequelize/core");

const UserMessageModel = (db) => db.define('UserMessage', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    user_id: { type: DataTypes.INTEGER, allowNull: false, },
    username: { type: DataTypes.STRING, allowNull: false, },
    message: { type: DataTypes.STRING, allowNull: false, },
    date: { type: DataTypes.DATE, allowNull: false, },
    channel: { type: DataTypes.STRING, allowNull: false, },
    extra_data: { type: DataTypes.STRING, allowNull: true, },
    message_type: { type: DataTypes.STRING, allowNull: false, },
    is_banned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, },
}, {
    tableName: 'osu_chat_log',
    timestamps: false
});
module.exports.UserMessageModel = UserMessageModel;