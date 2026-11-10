// Runs only against a local MongoDB: TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
const test = require('node:test');
const assert = require('node:assert');

const uri = process.env.TEST_MONGODB_URI;
const local = uri && /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri);

test(
	'board logs need a developer account, are owned by the token user, and reject bad batches',
	{ skip: !local && 'set TEST_MONGODB_URI to a local MongoDB' },
	async (t) => {
		const express = require('express');
		const jwt = require('jsonwebtoken');
		const mongoose = require('mongoose');

		process.env.JWT_SECRET = 'test-secret';
		const BoardLog = require('../models/BoardLog');
		const User = require('../models/User');
		const app = express();
		app.use(express.json({ limit: '5mb' }));
		app.use('/api/boardLog', require('../routes/boardLog'));

		await mongoose.connect(uri, { dbName: 'dealbreaker-boardlog-test' });
		await mongoose.connection.dropDatabase();
		const server = app.listen(0);
		const base = `http://127.0.0.1:${server.address().port}/api/boardLog`;
		t.after(async () => {
			server.close();
			await mongoose.connection.dropDatabase();
			await mongoose.disconnect();
		});

		// alice has the developer flag; bob is an ordinary account.
		const alice = (await User.create({ name: 'A', email: 'a@example.test', developer: true }))._id.toString();
		const bob = (await User.create({ name: 'B', email: 'b@example.test' }))._id.toString();
		const token = jwt.sign({ user: { id: alice } }, process.env.JWT_SECRET);
		const bobToken = jwt.sign({ user: { id: bob } }, process.env.JWT_SECRET);
		// Support switched diagnostics on for carol (still running) and dave (expired yesterday).
		const day = 24 * 60 * 60 * 1000;
		const carol = (await User.create({ name: 'C', email: 'c@example.test', diagnosticsUntil: new Date(Date.now() + day) }))._id.toString();
		const dave = (await User.create({ name: 'D', email: 'd@example.test', diagnosticsUntil: new Date(Date.now() - day) }))._id.toString();
		const carolToken = jwt.sign({ user: { id: carol } }, process.env.JWT_SECRET);
		const daveToken = jwt.sign({ user: { id: dave } }, process.env.JWT_SECRET);
		const post = async (body, tok = token) => {
			const res = await fetch(base, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(tok && { 'x-auth-token': tok }),
				},
				body: JSON.stringify(body),
			});
			return res.status;
		};
		const events = [
			{ t: 1, n: 0, type: 'drag.lift' },
			{ t: 2, n: 1, type: 'drag.end' },
		];

		assert.strictEqual(await post({ session: 's1', events }, null), 401);
		assert.strictEqual(await post({ session: 's1', events }, 'bad'), 401);
		assert.strictEqual(await post({ session: 's1', events }, bobToken), 403);
		assert.strictEqual(await post({ session: 's2', events }, daveToken), 403);
		assert.strictEqual(await post({ session: 's2', events }, carolToken), 201);
		assert.strictEqual(await post({ events }), 400);
		assert.strictEqual(await post({ session: 's1', events: [] }), 400);
		assert.strictEqual(await post({ session: 's1', events: [1, 2] }), 400);
		assert.strictEqual(await post({ session: 'x'.repeat(65), events }), 400);
		assert.strictEqual(await post({ session: 'a\nb', events }), 400);
		const many = Array.from({ length: 1001 }, (_, n) => ({ n, type: 'x' }));
		assert.strictEqual(await post({ session: 's1', events: many }), 413);
		const big = [{ n: 0, type: 'x', pad: 'y'.repeat(600 * 1024) }];
		assert.strictEqual(await post({ session: 's1', events: big }), 413);

		// userId comes from the token, not from the body.
		assert.strictEqual(
			await post({ session: 's1', events, userId: 'someone-else' }),
			201
		);
		const docs = await BoardLog.find({ session: 's1' }).lean();
		assert.strictEqual(docs.length, 1);
		assert.strictEqual(docs[0].userId.toString(), alice);
		assert.deepStrictEqual(
			docs[0].events.map((e) => e.type),
			['drag.lift', 'drag.end']
		);
	}
);
