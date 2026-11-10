// Turn the developer tools (board/gesture log) on or off for one account.
// Usage: node scripts/set-developer.js <email> [--off]
// Writes to whatever MONGODB_URI in .env points at (production today), or MONGODB_URI from the
// environment if set. Prints the database host before writing.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const email = process.argv[2];
const on = !process.argv.includes('--off');

async function main() {
	if (!email || email.startsWith('--')) throw new Error('usage: node scripts/set-developer.js <email> [--off]');
	await mongoose.connect(process.env.MONGODB_URI);
	console.log('database host:', mongoose.connection.host);
	const users = mongoose.connection.db.collection('users');
	const result = await users.updateOne({ email }, { $set: { developer: on } });
	if (!result.matchedCount) throw new Error(`no user ${email}`);
	console.log(`${email}: developer ${on ? 'on' : 'off'}`);
	await mongoose.disconnect();
}

main().catch((e) => {
	console.error('FAILED:', e.message);
	process.exit(1);
});
