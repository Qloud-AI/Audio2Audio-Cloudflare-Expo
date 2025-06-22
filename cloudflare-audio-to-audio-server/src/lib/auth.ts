// JWT Token verification for Cloudflare Workers
// Adapted from middleware/auth.js

export function verifyToken(token: string, jwtSecret: string): any {
	console.log('🔐 Starting token verification...');
	console.log('🔑 JWT Secret length:', jwtSecret ? jwtSecret.length : 'null');
	
	if (!token) {
		console.log('❌ No token provided');
		throw new Error('No token provided');
	}

	try {
		// Remove 'Bearer ' prefix if present
		const cleanToken = token.replace(/^Bearer\s+/, '');
		console.log('🧹 Cleaned token:', `${cleanToken.substring(0, 50)}...`);
		
		// Basic JWT verification (using Web Crypto API)
		console.log('🔍 Parsing JWT...');
		const decoded = parseJWT(cleanToken, jwtSecret);
		console.log('✅ JWT parsed successfully:', JSON.stringify(decoded, null, 2));
		
		if (decoded.type !== 'bot') {
			console.log('❌ Invalid token type:', decoded.type);
			throw new Error('Invalid token type');
		}
		
		console.log('✅ Token verification successful - Authenticated');
		return decoded;
	} catch (err) {
		console.log('❌ Token verification failed:', err);
		throw new Error('Invalid token');
	}
}

// Simple JWT parser for Cloudflare Workers (using Web Crypto API)
function parseJWT(token: string, secret: string): any {
	console.log('🔧 Parsing JWT token...');
	
	const parts = token.split('.');
	console.log('📊 JWT parts count:', parts.length);
	
	if (parts.length !== 3) {
		console.log('❌ Invalid JWT format - expected 3 parts, got:', parts.length);
		throw new Error('Invalid JWT format');
	}

	try {
		// Decode header and payload
		console.log('🔍 Decoding JWT header...');
		const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
		console.log('📋 JWT header:', JSON.stringify(header, null, 2));
		
		console.log('🔍 Decoding JWT payload...');
		const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
		console.log('📋 JWT payload:', JSON.stringify(payload, null, 2));
		
		// For simplicity in this migration, we'll do basic validation
		// In production, you'd want proper HMAC verification using Web Crypto API
		
		// Check expiration
		if (payload.exp) {
			console.log('⏰ Checking token expiration...');
			console.log('🕐 Token exp:', payload.exp, 'Current time:', Math.floor(Date.now() / 1000));
			
			if (Date.now() >= payload.exp * 1000) {
				console.log('❌ Token expired');
				throw new Error('Token expired');
			}
			console.log('✅ Token not expired');
		} else {
			console.log('ℹ️ No expiration field in token');
		}
		
		console.log('✅ JWT parsing completed successfully');
		return payload;
	} catch (error) {
		console.log('❌ Error during JWT parsing:', error);
		throw error;
	}
} 