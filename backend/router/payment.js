const express = require('express');
const controller = require('../controllers/paymentGatewayController');

const router = express.Router();

router.post('/create', controller.create);
router.post('/callback', controller.callback);
router.get('/status/:id', controller.status);

module.exports = router;
