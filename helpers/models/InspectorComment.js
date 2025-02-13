const { DataTypes } = require("@sequelize/core");

const InspectorCommentModel = (db) => db.define('Comment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, },
    commentor_id: { type: DataTypes.INTEGER, allowNull: false, },
    target_id: { type: DataTypes.INTEGER, allowNull: false, },
    date_created: { type: DataTypes.DATE, allowNull: false, },
    reply_to: { type: DataTypes.INTEGER, allowNull: true, },
    comment: { type: DataTypes.STRING, allowNull: false, },
}, {
    tableName: 'inspector_comments',
    timestamps: false,
});
module.exports.InspectorCommentModel = InspectorCommentModel;