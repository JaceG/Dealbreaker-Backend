// Runs only against a local MongoDB: TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
const test = require('node:test');
const assert = require('node:assert');

const uri = process.env.TEST_MONGODB_URI;
const local = uri && /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri);

test(
	'board logs need a login, are owned by the token user, and reject bad batches',
	{ skip: !local && 'set TEST_MONGODB_URI to a local MongoDB' },
	async (t) => {
		const express = require('express');
		const jwt = require('jsonwebtoken');
		const mongoose = require('mongoose');

		process.env.JWT_SECRET = 'test-secret';
		const BoardLog = require('../models/BoardLog');
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

		const alice = new mongoose.Types.ObjectId().toString();
		const token = jwt.sign({ user: { id: alice } }, process.env.JWT_SECRET);
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
		const docs = await BoardLog.find().lean();
		assert.strictEqual(docs.length, 1);
		assert.strictEqual(docs[0].userId.toString(), alice);
		assert.deepStrictEqual(
			docs[0].events.map((e) => e.type),
			['drag.lift', 'drag.end']
		);
	}
);
