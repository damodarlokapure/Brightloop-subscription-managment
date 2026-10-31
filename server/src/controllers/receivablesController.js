const { asyncHandler } = require('../utils/asyncHandler');
const { getReceivablesSummary } = require('../services/overdue');

async function summary(req, res) {
  const payload = await getReceivablesSummary(new Date());
  res.json(payload);
}

module.exports = {
  summary: asyncHandler(summary)
};
