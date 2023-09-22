const { Sequelize } = require("sequelize");

const InspectorUserModel = (db) => db.define('User', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    osu_id: { type: Sequelize.INTEGER, allowNull: false, },
    known_username: { type: Sequelize.STRING, allowNull: false, },
    background_image: { type: Sequelize.STRING, allowNull: true, },
    is_friends_public: { type: Sequelize.BOOLEAN, allowNull: false, },
    is_visitors_public: { type: Sequelize.BOOLEAN, allowNull: false, },
    is_banned: { type: Sequelize.BOOLEAN, allowNull: false, },
}, {
    tableName: 'inspector_users',
    timestamps: false
});
module.exports.InspectorUserModel = InspectorUserModel;