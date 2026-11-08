// Runs only against a local MongoDB: TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
const test = require('node:test');
const assert = require('node:assert');

const uri = process.env.TEST_MONGODB_URI;
const local = uri && /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri);

test(
	'flag history needs a login and shows only your own entries',
	{ skip: !local && 'set TEST_MONGODB_URI to a local MongoDB' },
	async (t) => {
		const express = require('express');
		const jwt = require('jsonwebtoken');
		const mongoose = require('mongoose');

		process.env.JWT_SECRET = 'test-secret';
		const FlagHistory = require('../models/FlagHistory');
		const app = express();
		app.use(express.json());
		app.use('/api/flagHistory', require('../routes/flagHistory'));

		await mongoose.connect(uri, { dbName: 'dealbreaker-flaghistory-test' });
		await mongoose.connection.dropDatabase();
		const server = app.listen(0);
		const base = `http://127.0.0.1:${server.address().port}/api/flagHistory`;
		t.after(async () => {
			server.close();
			await mongoose.connection.dropDatabase();
			await mongoose.disconnect();
		});

		const alice = new mongoose.Types.ObjectId().toString();
		const bob = new mongoose.Types.ObjectId().toString();
		const tokenFor = (id) =>
			jwt.sign({ user: { id } }, process.env.JWT_SECRET);
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
		// Every user's first profile is 'main', so Alice and Bob share profile and flag ids here.
		const entry = {
			profileId: 'main',
			profileName: 'Main Profile',
			flagId: '1234.5',
			flagTitle: 'Late',
			previousStatus: 'white',
			newStatus: 'yellow',
		};

		for (const [method, path] of [
			['GET', '/main/1234.5'],
			['POST', '/'],
			['POST', '/sync'],
			['POST', '/000000000000000000000000/attachment'],
		]) {
			const body = method === 'POST' ? {} : null;
			assert.strictEqual((await call(method, path, body)).status, 401);
			assert.strictEqual(
				(await call(method, path, body, 'not-a-token')).status,
				401
			);
		}

		// The owner comes from the token, not from the creatorId the app sends.
		const added = await call(
			'POST',
			'/',
			{ ...entry, creatorId: bob },
			tokenFor(alice)
		);
		assert.strictEqual(added.status, 201);
		assert.strictEqual(added.body.creatorId, alice);

		// Offline changes arrive with creatorId null; they used to be dropped.
		const synced = await call(
			'POST',
			'/sync',
			{
				changes: [
					{
						action: 'addFlagHistory',
						data: { ...entry, newStatus: 'red', creatorId: null },
					},
				],
			},
			tokenFor(alice)
		);
		assert.strictEqual(synced.body.count, 1);
		assert.strictEqual(synced.body.results[0].creatorId, alice);

		const aliceSees = await call(
			'GET',
			'/main/1234.5',
			null,
			tokenFor(alice)
		);
		assert.strictEqual(aliceSees.body.length, 2);
		const bobSees = await call('GET', '/main/1234.5', null, tokenFor(bob));
		assert.deepStrictEqual(bobSees.body, []);

		const attachment = { type: 'image', url: 'https://example.com/a.jpg' };
		const path = `/${added.body._id}/attachment`;
		assert.strictEqual(
			(await call('POST', path, { attachment }, tokenFor(bob))).status,
			404
		);
		const attached = await call(
			'POST',
			path,
			{ attachment },
			tokenFor(alice)
		);
		assert.strictEqual(attached.status, 200);
		assert.deepStrictEqual(attached.body.attachments, [attachment]);

		// The old search-everyone routes are gone.
		const search = await call(
			'GET',
			'/filter/byUser?userId=' + alice,
			null,
			tokenFor(bob)
		);
		assert.deepStrictEqual(search.body, []);
		assert.strictEqual(await FlagHistory.countDocuments(), 2);

		// Deleting a profile's history takes only your own entries for that profile.
		const sam = { ...entry, profileId: 'profile_1', profileName: 'Sam' };
		await call('POST', '/', sam, tokenFor(alice));
		await call('POST', '/', sam, tokenFor(bob));
		assert.strictEqual(
			(await call('DELETE', '/profile/main', null, tokenFor(alice))).status,
			400
		);
		assert.strictEqual(
			(await call('DELETE', '/profile/profile_1', null)).status,
			401
		);
		const cleared = await call('DELETE', '/profile/profile_1', null, tokenFor(alice));
		assert.deepStrictEqual(cleared.body, { deleted: 1 });
		assert.strictEqual(await FlagHistory.countDocuments({ profileId: 'profile_1' }), 1);
		assert.strictEqual(await FlagHistory.countDocuments(), 3);
	}
);
