const { DataTypes } = require("@sequelize/core");

const InspectorUserModel = (db) => db.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    osu_id: { type: DataTypes.INTEGER, allowNull: false, },
    known_username: { type: DataTypes.STRING, allowNull: false, },
    background_image: { type: DataTypes.STRING, allowNull: true, },
    is_visitors_public: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, },
    is_banned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, },
    is_private: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, }, //hides the full profile from public
    is_completion_mode: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, }, //hides parts of the profile from public
}, {
    tableName: 'inspector_users',
    timestamps: false
});
module.exports.InspectorUserModel = InspectorUserModel;