const express = require('express');
const controller = require('../controllers/aiController');

const router = express.Router();

router.post('/chat', controller.chat);
router.post('/recommend-service', controller.recommendService);
router.get('/history', controller.getHistory);

module.exports = router;
