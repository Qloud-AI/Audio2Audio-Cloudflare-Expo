// node tokengeneration.js
const crypto = require('crypto');

/**
 * Simple JWT implementation for German with Nik API
 * This creates tokens compatible with the Cloudflare Workers deployment
 */

// Configuration
const JWT_SECRET = 'your_jwt_secret_key_here'; // Must match the secret in Cloudflare Workers
const ALGORITHM = 'HS256';

/**
 * Base64 URL encode (removes padding and makes URL safe)
 */
function base64UrlEncode(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Create HMAC SHA256 signature
 */
function createSignature(data, secret) {
    return crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Generate JWT token
 * @param {Object} payload - The payload to include in the token
 * @param {string} secret - The secret key for signing
 * @param {number} expirationHours - Token expiration in hours (default: 87600 = 10 years)
 * @returns {string} JWT token
 */
function generateJWT(payload = {}, secret = JWT_SECRET, expirationHours = 87600) {
    // JWT Header
    const header = {
        alg: ALGORITHM,
        typ: 'JWT'
    };

    // Current timestamp
    const now = Math.floor(Date.now() / 1000);
    
    // JWT Payload with default values
    const defaultPayload = {
        userId: payload.userId || `user_${Date.now()}`,
        username: payload.username || 'german_learner',
        iat: now, // Issued at
        exp: now + (expirationHours * 60 * 60), // Expiration time
        ...payload // Override with any custom payload data
    };

    // Encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(defaultPayload));

    // Create signature
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = createSignature(data, secret);

    // Return complete JWT
    return `${data}.${signature}`;
}

/**
 * Decode JWT token (for verification/debugging)
 * Note: This doesn't verify the signature, just decodes the payload
 */
function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }

        const header = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
        const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());

        return { header, payload };
    } catch (error) {
        throw new Error(`Failed to decode JWT: ${error.message}`);
    }
}

/**
 * Check if token is expired
 */
function isTokenExpired(token) {
    try {
        const { payload } = decodeJWT(token);
        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
    } catch (error) {
        return true; // Consider invalid tokens as expired
    }
}

// Command line interface
if (require.main === module) {
    console.log('🎓 German with Nik - JWT Token Generator\n');

    // Parse command line arguments
    const args = process.argv.slice(2);
    let userId = null;
    let username = null;
    let hours = 87600; // Default to 10 years (365 days * 24 hours * 10 years)

    // Simple argument parsing
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--user-id' && args[i + 1]) {
            userId = args[i + 1];
            i++;
        } else if (args[i] === '--username' && args[i + 1]) {
            username = args[i + 1];
            i++;
        } else if (args[i] === '--hours' && args[i + 1]) {
            hours = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log('Usage: node tokengeneration.js [options]\n');
            console.log('Options:');
            console.log('  --user-id <id>      Custom user ID');
            console.log('  --username <name>   Custom username');
            console.log('  --hours <hours>     Token expiration in hours (default: 87600 = 10 years)');
            console.log('  --help, -h          Show this help message\n');
            console.log('Examples:');
            console.log('  node tokengeneration.js');
            console.log('  node tokengeneration.js --user-id user123 --username john');
            console.log('  node tokengeneration.js --hours 168   # 1 week');
            console.log('  node tokengeneration.js --hours 720   # 1 month');
            console.log('  node tokengeneration.js --hours 8760  # 1 year');
            console.log('  node tokengeneration.js --hours 87600 # 10 years (default)');
            process.exit(0);
        }
    }

    // Generate token with custom or default values
    const payload = {};
    if (userId) payload.userId = userId;
    if (username) payload.username = username;

    const token = generateJWT(payload, JWT_SECRET, hours);
    const decoded = decodeJWT(token);

    console.log('✅ Token generated successfully!\n');
    console.log('📋 Token Details:');
    console.log(`   User ID: ${decoded.payload.userId}`);
    console.log(`   Username: ${decoded.payload.username}`);
    console.log(`   Issued: ${new Date(decoded.payload.iat * 1000).toISOString()}`);
    console.log(`   Expires: ${new Date(decoded.payload.exp * 1000).toISOString()}`);
    console.log(`   Valid for: ${hours} hours\n`);
    
    console.log('🔑 JWT Token:');
    console.log(token);
    console.log('\n📱 WebSocket URL:');
    console.log(`wss://cloudflare-german-tutor.angshu-gupta789.workers.dev/ws?token=${token}`);
    console.log('\n💡 Copy the token above and use it in your client application!');
}

// Export functions for use in other modules
module.exports = {
    generateJWT,
    decodeJWT,
    isTokenExpired,
    JWT_SECRET
}; 