//this script is to store some data in the local database, like overall score statistics.
//mainly to circumvent extremely slow sql queries that don't need to be live
const schedule = require('node-schedule');
const scoreStatCacher = require("./cacher/jobScoreStatistics.js");
const scoreRankCacher = require("./cacher/jobScoreRanks.js");
const performanceDistCacher = require("./cacher/jobPerformanceDistribution.js");
const performanceRecordsCacher = require("./cacher/jobPerformanceRecords.js");
const monthlyFarmersCacher = require("./cacher/jobMonthlyFarmers.js");
const populationStatsCacher = require("./cacher/jobPopulationStats.js");
const systemStatsCacher = require("./cacher/jobSystemStats.js");
require('dotenv').config();

function StartCacher() {
    Loop();
}
module.exports = StartCacher;

const Cachers = [
    { cacher: performanceDistCacher, interval: '0 * * * *', data: [] },
    { cacher: performanceRecordsCacher, interval: '0 * * * *', data: [] },
    { cacher: scoreStatCacher, interval: '0 * * * *', data: ['24h', '7d', 'all'], onStart: true },
    { cacher: scoreStatCacher, interval: '*/30 * * * *', data: ['30min'], onStart: true },
    { cacher: scoreRankCacher, interval: '1 0 * * *', data: [] },
    // { cacher: monthlyFarmersCacher, interval: '0 * * * *', data: 'score' },
    // { cacher: monthlyFarmersCacher, interval: '0 * * * *', data: 'ss' },
    // { cacher: monthlyFarmersCacher, interval: '0 * * * *', data: 'pp' },
    { cacher: populationStatsCacher, interval: '0 * * * *', data: [] },
    { cacher: systemStatsCacher, interval: '*/15 * * * *', data: [] }
]

const jobQueue = [];

async function QueueProcessor() {
    while (true) {
        if (jobQueue.length > 0) {
            const job = jobQueue.shift();
            try {
                console.log(`[CACHER] Running ${job.cacher.name} ...`);
                if (job.cacher.runParallel) {
                    job.cacher.func(job.data);
                } else {
                    await job.cacher.func(job.data);
                }
            } catch (e) {
                // handle error
            }
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}
QueueProcessor();

async function Loop() {
    for await (const cacher of Cachers) {
        if (cacher.onStart) {
            jobQueue.push(cacher);
        }
        schedule.scheduleJob(cacher.interval, () => {
            console.log(`[CACHER] Queuing ${cacher.cacher.name} ...`);
            jobQueue.push(cacher);
        });
        console.log(`[CACHER] Scheduled ${cacher.cacher.name} to run every ${cacher.interval}`);
    }
}
// Loop();
