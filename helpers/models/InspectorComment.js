const { Sequelize } = require("sequelize");

const InspectorCommentModel = (db) => db.define('Comment', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, },
    commentor_id: { type: Sequelize.INTEGER, allowNull: false, },
    target_id: { type: Sequelize.INTEGER, allowNull: false, },
    date_created: { type: Sequelize.DATE, allowNull: false, },
    reply_to: { type: Sequelize.INTEGER, allowNull: true, },
    comment: { type: Sequelize.STRING, allowNull: false, },
}, {
    tableName: 'inspector_comments',
    timestamps: false,
});
module.exports.InspectorCommentModel = InspectorCommentModel;