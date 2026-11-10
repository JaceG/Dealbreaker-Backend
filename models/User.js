const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
	name: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: true,
		unique: true,
	},
	role: {
		type: String,
		default: 'user',
		enum: ['user', 'admin', 'guest'],
	},
	password: {
		type: String,
		// Password not required for OAuth users
	},
	// Google and Apple account IDs (the token's sub). null means the user disconnected it,
	// so signing in with that provider's email no longer reconnects it.
	googleId: {
		type: String,
	},
	appleId: {
		type: String,
	},
	profile_image: {
		type: String,
	},
	// Developer tools (the board/gesture log). Set only with scripts/set-developer.js, never from the app.
	developer: {
		type: Boolean,
		default: false,
	},
	// Support can turn the board/gesture log on for any account until this date (scripts/set-diagnostics.js),
	// so a user can reproduce a problem and send it in. Unset means off.
	diagnosticsUntil: {
		type: Date,
	},
	created_at: {
		type: Date,
		default: Date.now,
	},
});

// Never send the password hash back to a client.
UserSchema.set('toJSON', {
	transform: (doc, ret) => {
		delete ret.password;
		return ret;
	},
});

module.exports = mongoose.model('User', UserSchema);
