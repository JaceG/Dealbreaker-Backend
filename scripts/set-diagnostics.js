// Turn the board/gesture log on for any account for a while, so a user can reproduce a problem for support.
// Usage: node scripts/set-diagnostics.js <email> [--days 7] [--off]
// The app picks it up on its next launch or when it comes back to the foreground, and shows the user that
// diagnostics are on and until when. Writes to whatever MONGODB_URI points at (production today).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const email = process.argv[2];
const off = process.argv.includes('--off');
const i = process.argv.indexOf('--days');
const days = i > -1 ? Number(process.argv[i + 1]) : 7;

async function main() {
	if (!email || email.startsWith('--')) throw new Error('usage: node scripts/set-diagnostics.js <email> [--days 7] [--off]');
	if (!off && !(days > 0 && days <= 30)) throw new Error('--days must be between 1 and 30');
	await mongoose.connect(process.env.MONGODB_URI);
	console.log('database host:', mongoose.connection.host);
	const users = mongoose.connection.db.collection('users');
	const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
	const update = off ? { $unset: { diagnosticsUntil: '' } } : { $set: { diagnosticsUntil: until } };
	const result = await users.updateOne({ email }, update);
	if (!result.matchedCount) throw new Error(`no user ${email}`);
	console.log(off ? `${email}: diagnostics off` : `${email}: diagnostics on until ${until.toISOString()}`);
	await mongoose.disconnect();
}

main().catch((e) => {
	console.error('FAILED:', e.message);
	process.exit(1);
});
