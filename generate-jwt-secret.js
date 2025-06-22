// node generate-jwt-secret.js
const crypto = require('crypto');

console.log('🔐 JWT Secret Generator\n');

// Method 1: 32-character hexadecimal secret (recommended for most cases)
const secret32 = crypto.randomBytes(16).toString('hex');
console.log('✅ 32-character secret (recommended):');
console.log(secret32);
console.log('');

// Method 2: 64-character hexadecimal secret (extra secure)
const secret64 = crypto.randomBytes(32).toString('hex');
console.log('🔒 64-character secret (extra secure):');
console.log(secret64);
console.log('');

// Method 3: Base64 encoded secret
const secretBase64 = crypto.randomBytes(32).toString('base64');
console.log('📝 Base64 encoded secret:');
console.log(secretBase64);
console.log('');

console.log('💡 Usage Instructions:');
console.log('1. Copy one of the secrets above');
console.log('2. Replace "your_jwt_secret_key_here" in tokengeneration.js');
console.log('3. Update the JWT_SECRET in your Cloudflare Workers environment');
console.log('4. Use the same secret in both places for tokens to work!');
console.log('');
console.log('🚀 Cloudflare Workers Command:');
console.log(`wrangler secret put JWT_SECRET`);
console.log('   (Then paste your chosen secret when prompted)'); 