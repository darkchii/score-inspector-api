const { Op } = require("@sequelize/core");
const { OsuTeam, OsuTeamMember } = require("./db");

module.exports.GetTeams = GetTeams;
async function GetTeams(team_ids){
    const teams = await OsuTeam.findAll({
        where: {
            id: team_ids,
            deleted: false,
            short_name: { [Op.ne]: null }
        }
    });
    return teams;
}

module.exports.GetUserTeam = GetUserTeam;
async function GetUserTeam(user_id){
    const team_member = await OsuTeamMember.findOne({
        where: {
            user_id: user_id
        }
    });
    if(!team_member) return null;

    const team = await OsuTeam.findOne({
        where: {
            id: team_member.team_id,
            deleted: false,
            short_name: { [Op.ne]: null }
        }
    });

    return team;
}

module.exports.GetUsersTeams = GetUsersTeams;
async function GetUsersTeams(user_ids){
    const team_members = await OsuTeamMember.findAll({
        where: {
            user_id: user_ids,
        },
        include: {
            model: OsuTeam,
            where: {
                deleted: false,
                short_name: { [Op.ne]: null }
            }
        }
    });

    return team_members;
}