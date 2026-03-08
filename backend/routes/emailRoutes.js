const router = require('express').Router();
const { draftEmail, sendEmail } = require('../controllers/emailController');

router.post('/draft', draftEmail);
router.post('/send', sendEmail);


module.exports = router;
