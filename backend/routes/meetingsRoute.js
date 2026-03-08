const express = require("express");
const router = express.Router();
const meetingsController = require("../controllers/meetingsController");

router.post("/", meetingsController.createMeeting);
router.get("/:userName", meetingsController.getMeetingsByUser);

module.exports = router;