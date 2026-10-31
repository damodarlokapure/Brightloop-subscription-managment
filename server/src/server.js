const app = require('./app');
const { startPlanAutoCloseCron } = require('./jobs/planAutoClose');
const { port } = require('./config/env');

startPlanAutoCloseCron();

app.listen(port, () => {
  console.log(`Brightloop server running on http://localhost:${port}`);
});
