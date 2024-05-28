//this script is to store some data in the local database, like overall score statistics.
//mainly to circumvent extremely slow sql queries that don't need to be live
const schedule = require('node-schedule');
const scoreStatCacher = require("./cacher/jobScoreStatistics.js");
const scoreRankCacher = require("./cacher/jobScoreRanks.js");
const performanceDistCacher = require("./cacher/jobPerformanceDistribution.js");
const milestonesCacher = require("./cacher/jobMilestones.js");
const performanceRecordsCacher = require("./cacher/jobPerformanceRecords.js");
const monthlyFarmersCacher = require("./cacher/jobMonthlyFarmers.js");
const populationStatsCacher = require("./cacher/jobPopulationStats.js");
const systemStatsCacher = require("./cacher/jobSystemStats.js");
const mapPollCacher = require("./cacher/jobMapPoll.js");
const clansCacher = require("./cacher/jobClans.js");
const usersCacher = require("./cacher/jobUsers.js");
require('dotenv').config();

function StartCacher() {
    Loop();
}
module.exports = StartCacher;

const Cachers = [
    { cacher: scoreStatCacher, interval: '0 * * * *', data: ['24h', '7d', 'all'] },
    { cacher: scoreStatCacher, interval: '*/30 * * * *', data: ['30min'] },
    { cacher: scoreRankCacher, interval: '1 0 * * *', data: [] },
    { cacher: performanceDistCacher, interval: '0 * * * *', data: [] },
    { cacher: milestonesCacher, interval: '0 * * * *', data: [] },
    { cacher: performanceRecordsCacher, interval: '0 * * * *', data: [] },
    { cacher: monthlyFarmersCacher, interval: '0 * * * *', data: 'score' },
    { cacher: monthlyFarmersCacher, interval: '0 * * * *', data: 'ss' },
    { cacher: monthlyFarmersCacher, interval: '0 * * * *', data: 'pp' },
    { cacher: monthlyFarmersCacher, interval: '0 * * * *', data: 'clears' },
    { cacher: monthlyFarmersCacher, interval: '0 * * * *', data: 'fcclears' },
    { cacher: populationStatsCacher, interval: '0 * * * *', data: [] },
    { cacher: systemStatsCacher, interval: '*/15 * * * *', data: [] },
    { cacher: mapPollCacher, interval: '1 0 * * *', data: [] },
    { cacher: clansCacher, interval: '0 */1 * * *', data: [] }, //every hour
    { cacher: usersCacher, interval: '0 */1 * * *', data: [] }, //every hour
]

const jobQueue = [];

async function QueueProcessor() {
    while (true) {
        if (jobQueue.length > 0) {
            const job = jobQueue.shift();
            try {
                await job.cacher.func(job.data);
            } catch (e) {
                console.error(e);
            }
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}
QueueProcessor();

async function Loop() {
    for await (const cacher of Cachers) {
        schedule.scheduleJob(cacher.interval, () => {
            try{
                console.log(`[CACHER] Queuing ${cacher.cacher.name} ...`);
                // cacher.cacher.func(cacher.data);
                jobQueue.push(cacher);
            }catch(e){
                console.error(e);
            }
        });
        console.log(`[CACHER] Scheduled ${cacher.cacher.name} to run every ${cacher.interval}`);
    }
}
// Loop();
