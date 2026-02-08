const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// ច្រកសម្រាប់ទទួលការ Upgrade Plan
router.post("/upgrade", paymentController.processUpgrade);
// ច្រកសម្រាប់បោះបង់ Plan
router.post("/cancel", paymentController.cancelSubscription);

module.exports = router;