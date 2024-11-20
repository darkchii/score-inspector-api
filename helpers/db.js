const { Sequelize } = require('sequelize');
const { AltUserModel } = require('./models/AltUser');
const { InspectorCommentModel } = require('./models/InspectorComment');
const { InspectorUserModel } = require('./models/InspectorUser');
const { InspectorVisitorModel } = require('./models/InspectorVisitor');
const { AltScoreModel } = require('./models/AltScoreModel');
const { AltBeatmapModel } = require('./models/AltBeatmap');
const { AltBeatmapPackModel } = require('./models/AltBeatmapPack');
const { AltPriorityUserModel } = require('./models/AltPriorityUser');
const { AltUniqueSSModel } = require('./models/AltUniqueSS');
const { AltUniqueFCModel } = require('./models/AltUniqueFC');
const { AltUniqueDTFCModel } = require('./models/AltUniqueDTFC');
const { AltUserAchievementModel } = require('./models/AltUserAchievement');
const { InspectorScoreStatModel } = require('./models/InspectorScoreStat');
const { AltBeatmapEyupModel } = require('./models/AltBeatmapEyup');
const { AltBeatmapSSRatioModel } = require('./models/AltBeatmapSSRatio');
const { AltTopScoreModel } = require('./models/AltTopScoreModel');
const { InspectorMedalModel } = require('./models/InspectorMedal');
const { InspectorRoleModel } = require('./models/InspectorRole');
const { InspectorUserRoleModel } = require('./models/InspectorUserRole');
const { InspectorHistoricalScoreRankModel } = require('./models/InspectorHistoricalScoreRank');
const { OsuUserModel } = require('./models/OsuUser');
const { InspectorUserMilestoneModel } = require('./models/InspectorMilestone');
const { InspectorUserAccessTokenModel } = require('./models/InspectorUserAccessToken');
const { InspectorPerformanceRecordModel } = require('./models/InspectorPerformanceRecord.js');
const { InspectorCountryStatModel } = require('./models/InspectorCountryStat.js');
const { InspectorMapPollModel } = require('./models/InspectorMapPoll.js');
const { InspectorMapPollVoteModel } = require('./models/InspectorMapPollVote.js');
const { InspectorCompletionistModel } = require('./models/InspectorCompletionist.js');
const { InspectorClanModel } = require('./models/InspectorClan.js');
const { InspectorClanMemberModel } = require('./models/InspectorClanMember.js');
const { InspectorClanStatsModel } = require('./models/InspectorClanStats.js');
const { InspectorClanLogsModel } = require('./models/InspectorClanLogs.js');
const { InspectorClanRankingModel } = require('./models/InspectorClanRanking.js');
const { UserMessageModel } = require('./models/UserMessage.js');
const { TournamentModel } = require('./models/Tournament.js');
const { InspectorBackgroundSourceModel } = require('./models/InspectorBackgroundSource.js');
const { InspectorBackgroundTagModel } = require('./models/InspectorBackgroundTag.js');
const { InspectorBackgroundTagPairModel } = require('./models/InspectorBackgroundTagPair.js');
const { InspectorBackgroundSongSourceModel } = require('./models/InspectorBeatmapSongSource.js');
const { InspectorBeatmapDifficultyModel } = require('./models/InspectorBeatmapDifficulty.js');
require('dotenv').config();

let databases = {
    inspector: new Sequelize(
        process.env.MYSQL_DB, 
        process.env.MYSQL_USER, 
        process.env.MYSQL_PASS, 
        { 
            host: process.env.MYSQL_HOST, 
            dialect: 'mariadb', 
            timezone: 'Europe/Amsterdam', 
            logging: false,
            retry: {
                max: 10
            }
        }),
    osuAlt: new Sequelize(
        process.env.ALT_DB_DATABASE, 
        process.env.ALT_DB_USER, 
        process.env.ALT_DB_PASSWORD, 
        { 
            host: process.env.ALT_DB_HOST, 
            dialect: 'postgres', 
            logging: false,
            retry: {
                max: 10
            }
        })
};
module.exports.Databases = databases;

async function CheckConnection(database, timeout = 10000) {
    //just race between database.authenticate and a timeout

    let success = false;
    
    await Promise.race([
        database.authenticate().then(() => {
            success = true;
        }),
        new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, timeout);
        })
    ]);

    if(!success){
        throw new Error('Connection failed');
    }

    return success;
}

const InspectorUser = InspectorUserModel(databases.inspector);
const InspectorUserAccessToken = InspectorUserAccessTokenModel(databases.inspector);
const InspectorRole = InspectorRoleModel(databases.inspector);
const InspectorComment = InspectorCommentModel(databases.inspector);
const InspectorVisitor = InspectorVisitorModel(databases.inspector);
const InspectorScoreStat = InspectorScoreStatModel(databases.inspector);
const InspectorMedal = InspectorMedalModel(databases.inspector);
const InspectorUserRole = InspectorUserRoleModel(databases.inspector);
const InspectorHistoricalScoreRankOsu = InspectorHistoricalScoreRankModel(databases.inspector, 'osu');
const InspectorHistoricalScoreRankTaiko = InspectorHistoricalScoreRankModel(databases.inspector, 'taiko');
const InspectorHistoricalScoreRankFruits = InspectorHistoricalScoreRankModel(databases.inspector, 'fruits');
const InspectorHistoricalScoreRankMania = InspectorHistoricalScoreRankModel(databases.inspector, 'mania');
const InspectorUserMilestone = InspectorUserMilestoneModel(databases.inspector);
const InspectorPerformanceRecord = InspectorPerformanceRecordModel(databases.inspector);
const InspectorCountryStat = InspectorCountryStatModel(databases.inspector);
const InspectorMapPoll = InspectorMapPollModel(databases.inspector);
const InspectorMapPollVote = InspectorMapPollVoteModel(databases.inspector);
const InspectorCompletionist = InspectorCompletionistModel(databases.inspector);
const InspectorClan = InspectorClanModel(databases.inspector);
const InspectorClanMember = InspectorClanMemberModel(databases.inspector);
const InspectorClanStats = InspectorClanStatsModel(databases.inspector);
const InspectorClanLogs = InspectorClanLogsModel(databases.inspector);
const InspectorClanRanking = InspectorClanRankingModel(databases.inspector);
const InspectorOsuUser = OsuUserModel(databases.inspector);

const InspectorBackgroundSource = InspectorBackgroundSourceModel(databases.inspector);
const InspectorBackgroundTag = InspectorBackgroundTagModel(databases.inspector);
const InspectorBackgroundTagPair = InspectorBackgroundTagPairModel(databases.inspector);

const InspectorBeatmapSongSource = InspectorBackgroundSongSourceModel(databases.inspector);

const UserMessage = UserMessageModel(databases.inspector);
const Tournament = TournamentModel(databases.inspector);

InspectorUser.belongsToMany(InspectorRole, { as: 'roles', through: 'inspector_user_roles', foreignKey: 'user_id', otherKey: 'role_id' });
InspectorRole.belongsTo(InspectorUser, { as: 'roles', through: 'inspector_user_roles', foreignKey: 'user_id', otherKey: 'role_id' });
InspectorOsuUser.belongsTo(InspectorUser, { as: 'osu_user', foreignKey: 'user_id', targetKey: 'osu_id' });
InspectorUser.hasOne(InspectorOsuUser, { as: 'osu_user', foreignKey: 'user_id', sourceKey: 'osu_id' });
InspectorUserRole.belongsTo(InspectorUser, { as: 'user_roles', foreignKey: 'user_id', targetKey: 'id' });
InspectorComment.belongsTo(InspectorUser, { as: 'commentor', foreignKey: 'commentor_id', targetKey: 'osu_id' });
InspectorVisitor.belongsTo(InspectorUser, { as: 'visitor_user', foreignKey: 'visitor_id', targetKey: 'osu_id' });
InspectorVisitor.belongsTo(InspectorUser, { as: 'target_user', foreignKey: 'target_id', targetKey: 'osu_id' });
InspectorUserMilestone.belongsTo(InspectorOsuUser, { as: 'user', foreignKey: 'user_id', targetKey: 'user_id' });
InspectorUserMilestone.belongsTo(InspectorUser, { as: 'inspector_user', foreignKey: 'user_id', targetKey: 'osu_id' });
InspectorClanStats.belongsTo(InspectorClan, { as: 'clan', foreignKey: 'clan_id', targetKey: 'id' });
InspectorUser.hasOne(InspectorClanMember, { as: 'clan_member', foreignKey: 'osu_id', sourceKey: 'osu_id' });
InspectorClanMember.hasOne(InspectorClan, { as: 'clan', foreignKey: 'id', sourceKey: 'clan_id' });
InspectorClan.hasOne(InspectorClanStats, { as: 'clan_stats', foreignKey: 'clan_id', sourceKey: 'id' });
InspectorClan.hasMany(InspectorClanMember, { as: 'clan_members', foreignKey: 'clan_id' });
InspectorClanMember.hasOne(InspectorUser, { as: 'user', foreignKey: 'osu_id', sourceKey: 'osu_id' });
InspectorClan.hasMany(InspectorClanLogs, { as: 'logs', foreignKey: 'clan_id' });

const AltUser = AltUserModel(databases.osuAlt);
const AltPriorityUser = AltPriorityUserModel(databases.osuAlt);
const AltScore = AltScoreModel(databases.osuAlt);
const AltBeatmap = AltBeatmapModel(databases.osuAlt);
const AltBeatmapEyup = AltBeatmapEyupModel(databases.osuAlt);
const AltBeatmapSSRatio = AltBeatmapSSRatioModel(databases.osuAlt);
const AltTopScore = AltTopScoreModel(databases.osuAlt);
const AltBeatmapPack = AltBeatmapPackModel(databases.osuAlt);
const AltUniqueSS = AltUniqueSSModel(databases.osuAlt);
const AltUniqueFC = AltUniqueFCModel(databases.osuAlt);
const AltUniqueDTFC = AltUniqueDTFCModel(databases.osuAlt);
const AltUserAchievement = AltUserAchievementModel(databases.osuAlt);
const InspectorBeatmapDifficulty = InspectorBeatmapDifficultyModel(databases.inspector);

AltUser.hasOne(AltPriorityUser, { as: 'priority', foreignKey: 'user_id', sourceKey: 'user_id' });
AltPriorityUser.belongsTo(AltUser, { as: 'priority', foreignKey: 'user_id', targetKey: 'user_id' });

AltScore.hasOne(AltBeatmap, { as: 'beatmap', foreignKey: 'beatmap_id', sourceKey: 'beatmap_id' });
AltBeatmap.belongsTo(AltScore, { as: 'beatmap', foreignKey: 'beatmap_id', targetKey: 'beatmap_id' });
AltScore.hasOne(AltUser, { as: 'user', foreignKey: 'user_id', sourceKey: 'user_id' });
AltUser.belongsTo(AltScore, { as: 'user', foreignKey: 'user_id', targetKey: 'user_id' });
AltScore.hasOne(AltTopScore, { as: 'top_score', foreignKey: 'beatmap_id', sourceKey: 'beatmap_id' });
AltTopScore.belongsTo(AltScore, { as: 'top_score', foreignKey: 'beatmap_id', targetKey: 'beatmap_id' });

AltBeatmap.hasOne(AltBeatmapEyup, { as: 'eyup_sr', foreignKey: 'beatmap_id', sourceKey: 'beatmap_id' });
AltBeatmapEyup.belongsTo(AltBeatmap, { as: 'eyup_sr', foreignKey: 'beatmap_id', targetKey: 'beatmap_id' });
AltBeatmap.hasOne(AltBeatmapSSRatio, { as: 'ss_ratio', foreignKey: 'beatmap_id', sourceKey: 'beatmap_id' });
AltBeatmapSSRatio.belongsTo(AltBeatmap, { as: 'ss_ratio', foreignKey: 'beatmap_id', targetKey: 'beatmap_id' });

AltBeatmap.hasMany(AltBeatmapPack, { as: 'packs', foreignKey: 'beatmap_id' });
// AltBeatmapPack.belongsTo(AltBeatmap);

AltUser.hasMany(AltUniqueSS, { as: 'unique_ss', foreignKey: 'user_id', sourceKey: 'user_id' });
AltUniqueSS.belongsTo(AltUser, { as: 'unique_ss', foreignKey: 'user_id', targetKey: 'user_id' });

AltUser.hasMany(AltUniqueFC, { as: 'unique_fc', foreignKey: 'user_id', sourceKey: 'user_id' });
AltUniqueFC.belongsTo(AltUser, { as: 'unique_fc', foreignKey: 'user_id', targetKey: 'user_id' });

AltUser.hasMany(AltUniqueDTFC, { as: 'unique_dt_fc', foreignKey: 'user_id', sourceKey: 'user_id' });
AltUniqueDTFC.belongsTo(AltUser, { as: 'unique_dt_fc', foreignKey: 'user_id', targetKey: 'user_id' });

AltUser.hasMany(AltUserAchievement, { as: 'medals', foreignKey: 'user_id', sourceKey: 'user_id' });
AltUserAchievement.belongsTo(AltUser, { as: 'medals', foreignKey: 'user_id', targetKey: 'user_id' });

module.exports.InspectorUser = InspectorUser;
module.exports.InspectorUserAccessToken = InspectorUserAccessToken;
module.exports.InspectorRole = InspectorRole;
module.exports.InspectorUserRole = InspectorUserRole;
module.exports.InspectorComment = InspectorComment;
module.exports.InspectorVisitor = InspectorVisitor;
module.exports.InspectorScoreStat = InspectorScoreStat;
module.exports.InspectorMedal = InspectorMedal;
module.exports.InspectorHistoricalScoreRankOsu = InspectorHistoricalScoreRankOsu;
module.exports.InspectorHistoricalScoreRankTaiko = InspectorHistoricalScoreRankTaiko;
module.exports.InspectorHistoricalScoreRankFruits = InspectorHistoricalScoreRankFruits;
module.exports.InspectorHistoricalScoreRankMania = InspectorHistoricalScoreRankMania;
module.exports.InspectorOsuUser = InspectorOsuUser;
module.exports.InspectorUserMilestone = InspectorUserMilestone;
module.exports.InspectorPerformanceRecord = InspectorPerformanceRecord;
module.exports.InspectorCountryStat = InspectorCountryStat;
module.exports.InspectorMapPoll = InspectorMapPoll;
module.exports.InspectorMapPollVote = InspectorMapPollVote;
module.exports.InspectorCompletionist = InspectorCompletionist;
module.exports.InspectorBackgroundSource = InspectorBackgroundSource;
module.exports.InspectorBackgroundTag = InspectorBackgroundTag;
module.exports.InspectorBackgroundTagPair = InspectorBackgroundTagPair;
module.exports.InspectorBeatmapSongSource = InspectorBeatmapSongSource;

module.exports.InspectorBeatmapDifficulty = InspectorBeatmapDifficulty;

module.exports.UserMessage = UserMessage;

module.exports.Tournament = Tournament;

module.exports.AltUser = AltUser;
module.exports.AltPriorityUser = AltPriorityUser;
module.exports.AltScore = AltScore;
module.exports.AltTopScore = AltTopScore;
module.exports.AltBeatmap = AltBeatmap;
module.exports.AltBeatmapEyup = AltBeatmapEyup;
module.exports.AltBeatmapSSRatio = AltBeatmapSSRatio;
module.exports.AltBeatmapPack = AltBeatmapPack;
module.exports.AltUniqueSS = AltUniqueSS;
module.exports.AltUniqueFC = AltUniqueFC;
module.exports.AltUniqueDTFC = AltUniqueDTFC;
module.exports.AltUserAchievement = AltUserAchievement;
module.exports.InspectorClan = InspectorClan;
module.exports.InspectorClanMember = InspectorClanMember;
module.exports.InspectorClanStats = InspectorClanStats;
module.exports.InspectorClanLogs = InspectorClanLogs;
module.exports.InspectorClanRanking = InspectorClanRanking;

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

module.exports.GetHistoricalScoreRankModel = (mode) => {
    switch (mode) {
        case 'osu':
            return InspectorHistoricalScoreRankOsu;
        case 'taiko':
            return InspectorHistoricalScoreRankTaiko;
        case 'mania':
            return InspectorHistoricalScoreRankMania;
        case 'fruits':
            return InspectorHistoricalScoreRankFruits;
        default:
            return null;
    }
}

module.exports.CheckConnection = CheckConnection;