const mongoose = require('mongoose');

// Board and drag-gesture diagnostics uploaded by the app while testing. Kept 30 days.
const boardLogSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
	session: { type: String, required: true, index: true },
	events: { type: [mongoose.Schema.Types.Mixed], default: [] },
	receivedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

module.exports = mongoose.model('BoardLog', boardLogSchema);
