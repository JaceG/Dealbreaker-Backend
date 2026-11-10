// Read-only: prints board/gesture log events the app uploaded, oldest first.
// Usage: node scripts/read-board-log.js [--minutes 30] [--session <id>] [--email <user email>] [--follow]
// Reads whatever MONGODB_URI in .env points at (production today); it never writes.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > -1 ? process.argv[i + 1] : fallback;
};
const minutes = Number(arg('minutes', 60));
const session = arg('session');
const email = arg('email');
const follow = process.argv.includes('--follow');

const fmt = (e) => {
	const { t, n, type, ...rest } = e;
	const time = new Date(t).toISOString().slice(11, 23);
	return `${time} #${n} ${type} ${JSON.stringify(rest)}`;
};

async function main() {
	await mongoose.connect(process.env.MONGODB_URI);
	const db = mongoose.connection.db;
	console.error('database host:', mongoose.connection.host);
	const query = { receivedAt: { $gte: new Date(Date.now() - minutes * 60000) } };
	if (session) query.session = session;
	if (email) {
		const user = await db.collection('users').findOne({ email });
		if (!user) throw new Error(`no user ${email}`);
		query.userId = user._id;
	}
	const seen = new Set();
	const printNew = async () => {
		const docs = await db.collection('boardlogs').find(query).sort({ receivedAt: 1 }).toArray();
		for (const d of docs) {
			if (seen.has(String(d._id))) continue;
			seen.add(String(d._id));
			console.log(`--- session ${d.session}, ${d.events.length} events, received ${d.receivedAt.toISOString()}`);
			for (const e of d.events) console.log(fmt(e));
		}
	};
	await printNew();
	if (!follow) return mongoose.disconnect();
	setInterval(() => printNew().catch((e) => console.error('read failed:', e.message)), 5000);
}

main().catch((e) => {
	console.error('FAILED:', e.message);
	process.exit(1);
});
