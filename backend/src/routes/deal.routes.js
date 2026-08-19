const express = require('express');
const { listDeals, listFilters, getDeal } = require('../controllers/deal.controller');

const router = express.Router();

// All public — visitors browse without logging in.
router.get('/', listDeals);
router.get('/filters', listFilters);
router.get('/:idOrSlug', getDeal);

module.exports = router;
