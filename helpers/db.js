const { Sequelize } = require('sequelize');
const { AltUserModel } = require('./models/AltUser');
const { InspectorCommentModel } = require('./models/InspectorComment');
const { InspectorTokenModel } = require('./models/InspectorToken');
const { InspectorUserModel } = require('./models/InspectorUser');
const { InspectorVisitorModel } = require('./models/InspectorVisitor');
const { AltScoreModel } = require('./models/AltScoreModel');
const { AltBeatmapModel } = require('./models/AltBeatmap');
const { AltModdedStarsModel } = require('./models/AltModdedStars');
const { AltBeatmapPackModel } = require('./models/AltBeatmapPack');
const { AltPriorityUserModel } = require('./models/AltPriorityUser');
const { AltUniqueSSModel } = require('./models/AltUniqueSS');
const { AltUniqueFCModel } = require('./models/AltUniqueFC');
const { AltUniqueDTFCModel } = require('./models/AltUniqueDTFC');
const { AltUserAchievementModel } = require('./models/AltUserAchievement');
require('dotenv').config();

let databases = {
    inspector: new Sequelize(process.env.MYSQL_DB, process.env.MYSQL_USER, process.env.MYSQL_PASS, { host: process.env.MYSQL_HOST, dialect: 'mysql', timezone: '+01:00' }),
    osuAlt: new Sequelize(process.env.ALT_DB_DATABASE, process.env.ALT_DB_USER, process.env.ALT_DB_PASSWORD, { host: process.env.ALT_DB_HOST, dialect: 'postgres' })
};
module.exports.Databases = databases;

const InspectorUser = InspectorUserModel(databases.inspector);
const InspectorComment = InspectorCommentModel(databases.inspector);
const InspectorToken = InspectorTokenModel(databases.inspector);
const InspectorVisitor = InspectorVisitorModel(databases.inspector);

InspectorComment.belongsTo(InspectorUser, { as: 'commentor', foreignKey: 'commentor_id', targetKey: 'osu_id' });
InspectorVisitor.belongsTo(InspectorUser, { as: 'visitor_user', foreignKey: 'visitor_id', targetKey: 'osu_id' });
InspectorVisitor.belongsTo(InspectorUser, { as: 'target_user', foreignKey: 'target_id', targetKey: 'osu_id' });

const AltUser = AltUserModel(databases.osuAlt);
const AltPriorityUser = AltPriorityUserModel(databases.osuAlt);
const AltScore = AltScoreModel(databases.osuAlt);
const AltBeatmap = AltBeatmapModel(databases.osuAlt);
const AltModdedStars = AltModdedStarsModel(databases.osuAlt);
const AltBeatmapPack = AltBeatmapPackModel(databases.osuAlt);
const AltUniqueSS = AltUniqueSSModel(databases.osuAlt);
const AltUniqueFC = AltUniqueFCModel(databases.osuAlt);
const AltUniqueDTFC = AltUniqueDTFCModel(databases.osuAlt);
const AltUserAchievement = AltUserAchievementModel(databases.osuAlt);

AltUser.hasOne(AltPriorityUser, { as: 'priority', foreignKey: 'user_id', sourceKey: 'user_id' });
AltPriorityUser.belongsTo(AltUser, { as: 'priority', foreignKey: 'user_id', targetKey: 'user_id' });

AltScore.hasOne(AltBeatmap, { as: 'beatmap', foreignKey: 'beatmap_id', sourceKey: 'beatmap_id' });
AltBeatmap.belongsTo(AltScore, { as: 'beatmap', foreignKey: 'beatmap_id', targetKey: 'beatmap_id' });
AltScore.hasOne(AltUser, { as: 'user', foreignKey: 'user_id', sourceKey: 'user_id' });
AltUser.belongsTo(AltScore, { as: 'user', foreignKey: 'user_id', targetKey: 'user_id' });

AltScore.hasOne(AltModdedStars, { as: 'modded_sr', foreignKey: 'beatmap_id', sourceKey: 'beatmap_id' });
AltBeatmap.hasOne(AltModdedStars, { as: 'modded_sr', foreignKey: 'beatmap_id', sourceKey: 'beatmap_id' });
AltModdedStars.belongsTo(AltBeatmap, { as: 'modded_sr', foreignKey: 'beatmap_id', targetKey: 'beatmap_id' });

AltBeatmap.hasMany(AltBeatmapPack, { as: 'packs', foreignKey: 'beatmap_id', sourceKey: 'beatmap_id' });
AltBeatmapPack.belongsTo(AltBeatmap, { as: 'packs', foreignKey: 'beatmap_id', targetKey: 'beatmap_id' });

AltUser.hasMany(AltUniqueSS, { as: 'unique_ss', foreignKey: 'user_id', sourceKey: 'user_id' });
AltUniqueSS.belongsTo(AltUser, { as: 'unique_ss', foreignKey: 'user_id', targetKey: 'user_id' });

AltUser.hasMany(AltUniqueFC, { as: 'unique_fc', foreignKey: 'user_id', sourceKey: 'user_id' });
AltUniqueFC.belongsTo(AltUser, { as: 'unique_fc', foreignKey: 'user_id', targetKey: 'user_id' });

AltUser.hasMany(AltUniqueDTFC, { as: 'unique_dt_fc', foreignKey: 'user_id', sourceKey: 'user_id' });
AltUniqueDTFC.belongsTo(AltUser, { as: 'unique_dt_fc', foreignKey: 'user_id', targetKey: 'user_id' });

AltUser.hasMany(AltUserAchievement, { as: 'medals', foreignKey: 'user_id', sourceKey: 'user_id' });
AltUserAchievement.belongsTo(AltUser, { as: 'medals', foreignKey: 'user_id', targetKey: 'user_id' });

module.exports.InspectorUser = InspectorUser;
module.exports.InspectorComment = InspectorComment;
module.exports.InspectorToken = InspectorToken;
module.exports.InspectorVisitor = InspectorVisitor;
module.exports.AltUser = AltUser;
module.exports.AltPriorityUser = AltPriorityUser;
module.exports.AltScore = AltScore;
module.exports.AltBeatmap = AltBeatmap;
module.exports.AltModdedStars = AltModdedStars;
module.exports.AltBeatmapPack = AltBeatmapPack;
module.exports.AltUniqueSS = AltUniqueSS;
module.exports.AltUniqueFC = AltUniqueFC;
module.exports.AltUniqueDTFC = AltUniqueDTFC;
module.exports.AltUserAchievement = AltUserAchievement;

module.exports.Raw = Raw;
async function Raw(query, db = 'inspector') {
    return await databases[db].query(query);
}

module.exports.CloseConnections = CloseConnections;
function CloseConnections(options, exitCode) {
    Object.keys(databases).forEach((key) => {
        databases[key].close();
    });
    console.log('Closed all connections');
}
