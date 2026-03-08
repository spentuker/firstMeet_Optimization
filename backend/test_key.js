const crypto = require('crypto');
require('dotenv').config();

let PRIVATE_KEY = process.env.SIGNIN_PRIVATE_KEY || null;

if (PRIVATE_KEY) {
    console.log('Original Key starts with:', PRIVATE_KEY.substring(0, 20));

    if (!PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
        const cleanKey = PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '').trim();
        const formattedKey = `-----BEGIN PRIVATE KEY-----\n${cleanKey}\n-----END PRIVATE KEY-----`;

        try {
            // Test if it can be imported as a key object
            const keyObject = crypto.createPrivateKey(formattedKey);
            console.log('SUCCESS: Key successfully imported as PrivateKeyObject');
        } catch (err) {
            console.error('FAILED: Error importing key with PRIVATE KEY header:', err.message);

            try {
                const rsaFormattedKey = `-----BEGIN RSA PRIVATE KEY-----\n${cleanKey}\n-----END RSA PRIVATE KEY-----`;
                const rsaKeyObject = crypto.createPrivateKey(rsaFormattedKey);
                console.log('SUCCESS: Key successfully imported as RSA PRIVATE KEY');
            } catch (rsaErr) {
                console.error('FAILED: Error importing key with RSA PRIVATE KEY header:', rsaErr.message);
            }
        }
    } else {
        console.log('Key already has headers.');
        try {
            crypto.createPrivateKey(PRIVATE_KEY);
            console.log('SUCCESS: Key is valid PEM as is.');
        } catch (err) {
            console.error('FAILED: Existing PEM key is invalid:', err.message);
        }
    }
} else {
    console.log('SIGNIN_PRIVATE_KEY not found in .env');
}
