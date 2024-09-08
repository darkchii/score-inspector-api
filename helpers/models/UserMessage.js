const { Sequelize } = require("sequelize");

const UserMessageModel = (db) => db.define('UserMessage', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    user_id: { type: Sequelize.INTEGER, allowNull: false, },
    username: { type: Sequelize.STRING, allowNull: false, },
    message: { type: Sequelize.STRING, allowNull: false, },
    date: { type: Sequelize.DATE, allowNull: false, },
    channel: { type: Sequelize.STRING, allowNull: false, },
    extra_data: { type: Sequelize.STRING, allowNull: true, },
    message_type: { type: Sequelize.STRING, allowNull: false, },
}, {
    tableName: 'osu_chat_log',
    timestamps: false
});
module.exports.UserMessageModel = UserMessageModel;