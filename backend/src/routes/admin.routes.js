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
const {
  finderStatus,
  searchProducts,
  resolveLinks,
} = require('../controllers/finder.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// The finder makes outbound requests to the stores, so it gets its own bucket: a stuck
// "Search" button must not be able to hammer Amazon or Flipkart on our behalf.
const finderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many searches. Wait a minute and try again.' },
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

router.get('/finder/status', finderStatus);
router.post('/finder/search', finderLimiter, searchProducts);
router.post('/finder/resolve', finderLimiter, resolveLinks);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

module.exports = router;
