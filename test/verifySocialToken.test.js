const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
	verifyAppleIdToken,
	verifyGoogleIdToken,
} = require('../utils/verifySocialToken');

const pair = () =>
	crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const apple = pair();
const attacker = pair();
const keys = async () => [
	{ ...apple.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256' },
];
const appleToken = (overrides = {}, key = apple.privateKey) =>
	jwt.sign({ sub: 'apple-user-1', email: 'a@example.com' }, key, {
		algorithm: 'RS256',
		keyid: 'k1',
		issuer: 'https://appleid.apple.com',
		audience: 'com.jace88.dealbreaker',
		expiresIn: '5m',
		...overrides,
	});

test('Apple: accepts a token signed by Apple for this app', async () => {
	assert.deepStrictEqual(await verifyAppleIdToken(appleToken(), keys), {
		sub: 'apple-user-1',
		email: 'a@example.com',
	});
});
test('Apple: rejects a token for another app', async () => {
	await assert.rejects(
		verifyAppleIdToken(appleToken({ audience: 'com.other.app' }), keys)
	);
});
test('Apple: rejects the wrong issuer', async () => {
	await assert.rejects(
		verifyAppleIdToken(appleToken({ issuer: 'https://evil.example' }), keys)
	);
});
test('Apple: rejects an expired token', async () => {
	await assert.rejects(
		verifyAppleIdToken(appleToken({ expiresIn: -60 }), keys)
	);
});
test('Apple: rejects a token signed by someone else', async () => {
	await assert.rejects(
		verifyAppleIdToken(appleToken({}, attacker.privateKey), keys)
	);
});
test('Apple: rejects an unsigned token', async () => {
	const unsigned = jwt.sign(
		{ sub: 'x', iss: 'https://appleid.apple.com', aud: 'com.jace88.dealbreaker' },
		null,
		{ algorithm: 'none', keyid: 'k1' }
	);
	await assert.rejects(verifyAppleIdToken(unsigned, keys));
});
test('Apple: rejects a missing or garbage token', async () => {
	await assert.rejects(verifyAppleIdToken(undefined, keys));
	await assert.rejects(verifyAppleIdToken('not-a-token', keys));
});

const googleInfo = (overrides = {}) => async () => ({
	aud: 'ios-client',
	iss: 'https://accounts.google.com',
	exp: String(Math.floor(Date.now() / 1000) + 300),
	email_verified: 'true',
	sub: 'google-user-1',
	email: 'g@example.com',
	name: 'G User',
	...overrides,
});
process.env.GOOGLE_CLIENT_ID = 'ios-client, web-client';

test('Google: accepts a verified token for either listed client', async () => {
	assert.strictEqual(
		(await verifyGoogleIdToken('t', googleInfo())).email,
		'g@example.com'
	);
	assert.strictEqual(
		(await verifyGoogleIdToken('t', googleInfo({ aud: 'web-client' }))).sub,
		'google-user-1'
	);
});
test('Google: rejects a token for another app', async () => {
	await assert.rejects(
		verifyGoogleIdToken('t', googleInfo({ aud: 'someone-elses-app' }))
	);
});
test('Google: rejects the wrong issuer, expiry or unverified email', async () => {
	await assert.rejects(verifyGoogleIdToken('t', googleInfo({ iss: 'evil' })));
	await assert.rejects(verifyGoogleIdToken('t', googleInfo({ exp: '1' })));
	await assert.rejects(
		verifyGoogleIdToken('t', googleInfo({ email_verified: 'false' }))
	);
});
test('Google: rejects when Google says the token is invalid', async () => {
	await assert.rejects(
		verifyGoogleIdToken('t', async () => {
			throw new Error('400 invalid_token');
		})
	);
});
