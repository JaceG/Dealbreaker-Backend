const express = require('express');
const router = express.Router();
const BoardLog = require('../models/BoardLog');
const auth = require('../middleware/auth');

const MAX_EVENTS = 1000;
const MAX_BYTES = 512 * 1024;

router.use(auth);

// A batch of board/gesture events from one app session. Stored as sent, owned by the token's user.
router.post('/', async (req, res) => {
	const { session, events } = req.body || {};
	// Plain ids only (the app sends base-36 time plus a random suffix), so the log line stays one line.
	if (typeof session !== 'string' || !/^[\w-]{1,64}$/.test(session)) {
		return res.status(400).json({ message: 'session required' });
	}
	if (!Array.isArray(events) || events.length === 0) {
		return res.status(400).json({ message: 'events required' });
	}
	if (
		events.length > MAX_EVENTS ||
		JSON.stringify(events).length > MAX_BYTES
	) {
		return res.status(413).json({ message: 'batch too large' });
	}
	if (!events.every((e) => e && typeof e === 'object' && !Array.isArray(e))) {
		return res.status(400).json({ message: 'events must be objects' });
	}
	try {
		await BoardLog.create({ userId: req.user.id, session, events });
		// One line per batch, so a test can be followed live in the server logs.
		const types = {};
		for (const e of events) {
			// The app's own event names only; anything else is counted as 'other' so the log line stays clean.
			const type = typeof e.type === 'string' && /^[\w.]{1,40}$/.test(e.type) ? e.type : 'other';
			types[type] = (types[type] || 0) + 1;
		}
		console.log(
			`boardlog user=${req.user.id} session=${session} n=${events.length} ${JSON.stringify(types)}`
		);
		res.status(201).json({ stored: events.length });
	} catch (error) {
		console.error('Error saving board log:', error);
		res.status(500).json({ message: 'Server error' });
	}
});

module.exports = router;
