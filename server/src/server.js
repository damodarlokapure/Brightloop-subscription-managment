const app = require('./app');
const { port } = require('./config/env');

app.listen(port, () => {
  console.log(`Brightloop server running on http://localhost:${port}`);
});
