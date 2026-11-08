// Runs only against a local MongoDB: TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
const test = require('node:test');
const assert = require('node:assert');

const uri = process.env.TEST_MONGODB_URI;
const local = uri && /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri);

test(
	'boards and uploads need a login, and a board belongs to the token owner',
	{ skip: !local && 'set TEST_MONGODB_URI to a local MongoDB' },
	async (t) => {
		const express = require('express');
		const jwt = require('jsonwebtoken');
		const mongoose = require('mongoose');

		process.env.JWT_SECRET = 'test-secret';
		process.env.S3_BUCKET_NAME = 'test-bucket';
		const Dealbreaker = require('../models/Dealbreaker');
		const app = express();
		app.use(express.json());
		app.use('/api/dealbreaker', require('../routes/dealbreaker'));
		app.use('/api/upload', require('../routes/upload'));

		await mongoose.connect(uri, { dbName: 'dealbreaker-board-test' });
		await mongoose.connection.dropDatabase();
		const server = app.listen(0);
		const base = `http://127.0.0.1:${server.address().port}/api`;
		t.after(async () => {
			server.close();
			await mongoose.connection.dropDatabase();
			await mongoose.disconnect();
		});

		const alice = new mongoose.Types.ObjectId().toString();
		const bob = new mongoose.Types.ObjectId().toString();
		const tokenFor = (id) =>
			jwt.sign({ user: { id } }, process.env.JWT_SECRET);
		const post = async (path, body, token) => {
			const res = await fetch(base + path, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token && { 'x-auth-token': token }),
				},
				body: JSON.stringify(body),
			});
			return {
				status: res.status,
				body: await res.json().catch(() => null),
			};
		};

		for (const path of [
			'/dealbreaker/get-dealbreakers',
			'/dealbreaker/add-dealbreaker',
			'/upload',
			'/upload/direct',
			'/upload/custom',
		]) {
			assert.strictEqual((await post(path, {})).status, 401, path);
			assert.strictEqual(
				(await post(path, {}, 'not-a-token')).status,
				401,
				path
			);
		}

		// Past the login check without touching S3: no file means 400.
		assert.strictEqual(
			(await post('/upload/direct', {}, tokenFor(alice))).status,
			400
		);
		// The caller-chosen-bucket route is gone.
		assert.strictEqual(
			(await post('/upload/custom', {}, tokenFor(alice))).status,
			404
		);

		// Bob names Alice's id in the body; the board still lands on Bob.
		const saved = await post(
			'/dealbreaker/add-dealbreaker',
			{ dealbreaker: { main: 'bob' }, userId: alice },
			tokenFor(bob)
		);
		assert.strictEqual(saved.status, 200);
		await post(
			'/dealbreaker/add-dealbreaker',
			{ dealbreaker: { main: 'alice' } },
			tokenFor(alice)
		);

		const bobAsksForAlice = await post(
			'/dealbreaker/get-dealbreakers',
			{ id: alice },
			tokenFor(bob)
		);
		assert.deepStrictEqual(bobAsksForAlice.body, { main: 'bob' });
		const aliceBoard = await post(
			'/dealbreaker/get-dealbreakers',
			{},
			tokenFor(alice)
		);
		assert.deepStrictEqual(aliceBoard.body, { main: 'alice' });
		assert.strictEqual(await Dealbreaker.countDocuments(), 2);
	}
);
