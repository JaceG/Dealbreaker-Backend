const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Apple issues identity tokens for the app's bundle ID (app.json ios.bundleIdentifier).
const APPLE_AUDIENCE = 'com.jace88.dealbreaker';
const APPLE_ISSUER = 'https://appleid.apple.com';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

const fetchAppleKeys = async () =>
	(await axios.get('https://appleid.apple.com/auth/keys')).data.keys;

// Google's endpoint checks the token's signature and expiry before returning its claims.
const fetchGoogleTokenInfo = async (idToken) =>
	(
		await axios.get('https://oauth2.googleapis.com/tokeninfo', {
			params: { id_token: idToken },
		})
	).data;

// Returns { sub, email } from a verified Apple identity token, or throws.
const verifyAppleIdToken = async (idToken, getKeys = fetchAppleKeys) => {
	const decoded = jwt.decode(idToken, { complete: true });
	if (!decoded) throw new Error('Malformed Apple token');
	const jwk = (await getKeys()).find((k) => k.kid === decoded.header.kid);
	if (!jwk) throw new Error('Unknown Apple signing key');
	const payload = jwt.verify(
		idToken,
		crypto.createPublicKey({ key: jwk, format: 'jwk' }),
		{ algorithms: ['RS256'], issuer: APPLE_ISSUER, audience: APPLE_AUDIENCE }
	);
	return { sub: payload.sub, email: payload.email };
};

// Returns { sub, email, name } from a verified Google ID token, or throws.
// GOOGLE_CLIENT_ID may list several client IDs separated by commas (iOS and web).
const verifyGoogleIdToken = async (
	idToken,
	getTokenInfo = fetchGoogleTokenInfo
) => {
	const info = await getTokenInfo(idToken);
	const audiences = (process.env.GOOGLE_CLIENT_ID || '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
	if (!audiences.includes(info.aud))
		throw new Error('Google token is for another app');
	if (!GOOGLE_ISSUERS.includes(info.iss))
		throw new Error('Google token has the wrong issuer');
	if (Number(info.exp) * 1000 < Date.now())
		throw new Error('Google token has expired');
	if (String(info.email_verified) !== 'true')
		throw new Error('Google email is not verified');
	return { sub: info.sub, email: info.email, name: info.name };
};

const verifyIdToken = (type, idToken) =>
	type === 'google'
		? verifyGoogleIdToken(idToken)
		: verifyAppleIdToken(idToken);

module.exports = { verifyAppleIdToken, verifyGoogleIdToken, verifyIdToken };
