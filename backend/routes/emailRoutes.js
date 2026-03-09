const router = require('express').Router();
const { draftEmail, sendEmail, getMeetingRecapData } = require('../controllers/emailController');

router.post('/draft', draftEmail);
router.post('/send', sendEmail);
router.get('/meeting-recap/:meetingId', getMeetingRecapData);

module.exports = router;
