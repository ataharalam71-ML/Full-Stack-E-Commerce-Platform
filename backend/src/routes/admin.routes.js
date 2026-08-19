const express = require('express');
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
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

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

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

module.exports = router;
