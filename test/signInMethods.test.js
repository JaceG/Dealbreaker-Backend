// Runs only against a local MongoDB: TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
const test = require('node:test');
const assert = require('node:assert');

const uri = process.env.TEST_MONGODB_URI;
const local = uri && /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri);

test(
	'sign-in methods',
	{ skip: !local && 'set TEST_MONGODB_URI to a local MongoDB' },
	async (t) => {
		const bcrypt = require('bcrypt');
		const express = require('express');
		const jwt = require('jsonwebtoken');
		const mongoose = require('mongoose');

		// Stand-in for Google and Apple: each test token maps to the claims they would sign.
		const claims = {
			'google:alice': {
				sub: '1001',
				email: 'alice@example.com',
				name: 'Alice',
			},
			'apple:alice': {
				sub: '000111.aaa.0001',
				email: 'x1@privaterelay.appleid.com',
			},
			'google:bob': {
				sub: '1002',
				email: 'bob@example.com',
				name: 'Bob',
			},
			'google:carol': {
				sub: '1003',
				email: 'carol@example.com',
				name: 'Carol',
			},
			'apple:dan': { sub: '000222.ddd.0002', email: 'dan@example.com' },
		};
		require('../utils/verifySocialToken').verifyIdToken = async (
			type,
			token
		) => {
			if (!claims[`${type}:${token}`]) throw new Error('bad token');
			return claims[`${type}:${token}`];
		};
		process.env.JWT_SECRET = 'test-secret';
		const User = require('../models/User');
		const app = express();
		app.use(express.json());
		app.use('/api/auth', require('../routes/auth'));
		app.use('/api/myAccount', require('../routes/myAccount'));

		await mongoose.connect(uri, { dbName: 'dealbreaker-signin-test' });
		await mongoose.connection.dropDatabase();
		const server = app.listen(0);
		const base = `http://127.0.0.1:${server.address().port}/api`;
		t.after(async () => {
			server.close();
			await mongoose.connection.dropDatabase();
			await mongoose.disconnect();
		});

		const call = async (method, path, body, token) => {
			const res = await fetch(base + path, {
				method,
				headers: {
					'Content-Type': 'application/json',
					...(token && { 'x-auth-token': token }),
				},
				body: body && JSON.stringify(body),
			});
			return {
				status: res.status,
				body: await res.json().catch(() => null),
			};
		};
		// The app also sends an email and a placeholder password; the server must ignore both.
		const signIn = (type, idToken) =>
			call('POST', '/auth/login', {
				type,
				idToken,
				role: 'user',
				email: 'spoof@example.com',
				password: 'x',
			});
		const userId = (res) => jwt.decode(res.body.token).user.id;
		const methods = async (token) =>
			(await call('GET', '/myAccount/signInMethods', null, token)).body;

		await t.test(
			'Google sign-in creates one account and finds it again by Google ID',
			async () => {
				const first = await signIn('google', 'alice');
				const again = await signIn('google', 'alice');
				assert.equal(first.status, 200);
				assert.equal(userId(again), userId(first));
				assert.deepEqual(await methods(first.body.token), {
					email: 'alice@example.com',
					hasPassword: false,
					google: true,
					apple: false,
				});
			}
		);

		await t.test(
			'Apple with a hidden email connects, then signs in to the same account',
			async () => {
				const alice = await signIn('google', 'alice');
				const connected = await call(
					'POST',
					'/myAccount/connect',
					{ type: 'apple', idToken: 'alice' },
					alice.body.token
				);
				assert.equal(connected.status, 200);
				assert.equal(connected.body.apple, true);
				assert.equal(
					userId(await signIn('apple', 'alice')),
					userId(alice)
				);
				const forged = await call(
					'POST',
					'/myAccount/connect',
					{ type: 'apple', idToken: 'forged' },
					alice.body.token
				);
				assert.equal(forged.status, 401);
			}
		);

		await t.test(
			'Connect refuses a sign-in that belongs to another account',
			async () => {
				const alice = await signIn('google', 'alice');
				const bob = await signIn('google', 'bob');
				const res = await call(
					'POST',
					'/myAccount/connect',
					{ type: 'google', idToken: 'bob' },
					alice.body.token
				);
				assert.equal(res.status, 409);
				const res2 = await call(
					'POST',
					'/myAccount/connect',
					{ type: 'apple', idToken: 'alice' },
					bob.body.token
				);
				assert.equal(res2.status, 409);
			}
		);

		await t.test(
			'Disconnect keeps one way in, and email does not reconnect it',
			async () => {
				const carol = await signIn('google', 'carol');
				const token = carol.body.token;
				const last = await call(
					'POST',
					'/myAccount/disconnect',
					{ type: 'google' },
					token
				);
				assert.equal(last.status, 400);

				const setPassword = await call(
					'POST',
					'/myAccount',
					{ type: 2, newPassword: 'secret123' },
					token
				);
				assert.equal(setPassword.status, 200);
				assert.equal(
					setPassword.body.password,
					undefined,
					'password hash must not be sent'
				);

				const off = await call(
					'POST',
					'/myAccount/disconnect',
					{ type: 'google' },
					token
				);
				assert.equal(off.status, 200);
				assert.equal(off.body.google, false);
				assert.equal((await signIn('google', 'carol')).status, 403);

				const back = await call(
					'POST',
					'/myAccount/connect',
					{ type: 'google', idToken: 'carol' },
					token
				);
				assert.equal(back.status, 200);
				assert.equal(
					userId(await signIn('google', 'carol')),
					userId(carol)
				);
			}
		);

		await t.test(
			'Old Apple accounts move their ID out of googleId, and the old fixed password is not a password',
			async () => {
				const dan = await User.create({
					name: 'Dan',
					email: 'dan@example.com',
					googleId: '000222.ddd.0002',
					password: await bcrypt.hash('social_login_placeholder', 10),
				});
				const signedIn = await signIn('apple', 'dan');
				assert.equal(userId(signedIn), dan.id);
				const token = signedIn.body.token;
				assert.deepEqual(await methods(token), {
					email: 'dan@example.com',
					hasPassword: false,
					google: false,
					apple: true,
				});
				const short = await call(
					'POST',
					'/myAccount',
					{ type: 2, newPassword: '123' },
					token
				);
				assert.equal(short.status, 400);
				const set = await call(
					'POST',
					'/myAccount',
					{ type: 2, newPassword: 'secret123' },
					token
				);
				assert.equal(set.status, 200);
				const noOld = await call(
					'POST',
					'/myAccount',
					{ type: 2, newPassword: 'other123' },
					token
				);
				assert.equal(noOld.status, 422);
			}
		);
	}
);
