const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  listDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  deleteManyDeals,
  toggleDealFlag,
  bulkCreateDeals,
  getStats,
  exportDeals,
  getSettings,
  updateSettings,
} = require('../controllers/admin.controller');
const { aiStatus, suggestDeals } = require('../controllers/ai.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// The AI finder calls a paid API and takes ~30s per search, so it gets its own tight
// bucket - a stuck "Search" button must not be able to run up a bill.
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI searches. Wait a few minutes and try again.' },
});

// Everything below needs a valid admin JWT.
router.use(requireAuth, requireAdmin);

router.get('/stats', getStats);

router.get('/deals', listDeals);
router.get('/deals/export', exportDeals);
router.post('/deals', createDeal);
router.post('/deals/bulk', bulkCreateDeals);
router.delete('/deals', deleteManyDeals);
router.put('/deals/:id', updateDeal);
router.patch('/deals/:id/toggle', toggleDealFlag);
router.delete('/deals/:id', deleteDeal);

router.get('/ai/status', aiStatus);
router.post('/ai/suggest', aiLimiter, suggestDeals);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

module.exports = router;
