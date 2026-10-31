const cron = require('node-cron');
const { closeExpiredPlans } = require('../services/planService');
const { runBillingRun } = require('../services/billing');

async function runPlanAutoCloseJob() {
  return closeExpiredPlans();
}

async function runBillingJob() {
  return runBillingRun(new Date(), null, { dryRun: false });
}

function startPlanAutoCloseCron() {
  cron.schedule('5 0 * * *', async () => {
    try {
      const result = await runPlanAutoCloseJob();
      console.log(`Plan auto-close job completed: ${result.closedCount} plans closed.`);
    } catch (error) {
      console.error('Plan auto-close job failed:', error);
    }
  }, {
    timezone: 'UTC'
  });

  cron.schedule('0 1 * * *', async () => {
    try {
      const summary = await runBillingJob();
      console.log(`Recurring billing job completed: created=${summary.created}, skipped=${summary.skipped}, failed=${summary.failed.length}`);
    } catch (error) {
      console.error('Recurring billing job failed:', error);
    }
  }, {
    timezone: 'UTC'
  });
}

module.exports = {
  runPlanAutoCloseJob,
  runBillingJob,
  startPlanAutoCloseCron
};
