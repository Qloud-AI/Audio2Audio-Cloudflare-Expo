// JWT Token verification for Cloudflare Workers
// Adapted from middleware/auth.js

export async function verifyToken(token: string, jwtSecret: string): Promise<any> {
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
		const decoded = await parseJWT(cleanToken, jwtSecret);
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

// Secure JWT parser with proper signature verification using Web Crypto API
async function parseJWT(token: string, secret: string): Promise<any> {
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
		
		// Verify algorithm is HS256
		if (header.alg !== 'HS256') {
			console.log('❌ Unsupported algorithm:', header.alg);
			throw new Error('Unsupported algorithm');
		}
		
		console.log('🔍 Decoding JWT payload...');
		const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
		console.log('📋 JWT payload:', JSON.stringify(payload, null, 2));
		
		// CRITICAL SECURITY: Verify signature using HMAC-SHA256
		console.log('🔐 Verifying JWT signature...');
		const data = `${parts[0]}.${parts[1]}`;
		const encodedSignature = parts[2];
		
		const isValid = await verifySignature(data, encodedSignature, secret);
		if (!isValid) {
			console.log('❌ Invalid JWT signature');
			throw new Error('Invalid signature');
		}
		console.log('✅ JWT signature verified successfully');
		
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

// Helper function to verify HMAC-SHA256 signature using Web Crypto API
async function verifySignature(data: string, encodedSignature: string, secret: string): Promise<boolean> {
	console.log('🔐 Starting signature verification...');
	
	try {
		// Import the secret key for HMAC verification
		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['verify']
		);
		
		// Decode the signature
		const signature = base64UrlDecode(encodedSignature);
		
		// Verify the signature
		const isValid = await crypto.subtle.verify(
			'HMAC',
			key,
			signature,
			new TextEncoder().encode(data)
		);
		
		console.log('🔐 Signature verification result:', isValid);
		return isValid;
	} catch (error) {
		console.log('❌ Error during signature verification:', error);
		return false;
	}
}

// Helper function to decode base64url
function base64UrlDecode(str: string): ArrayBuffer {
	// Add padding if needed
	const padding = 4 - (str.length % 4);
	if (padding !== 4) {
		str += '='.repeat(padding);
	}
	
	// Replace URL-safe characters
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	
	// Decode to binary string, then to ArrayBuffer
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
} 