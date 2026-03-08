const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");

router.get("/admin", analyticsController.getAdminStats);
router.get("/employee", analyticsController.getEmployeeStats);

module.exports = router;
