require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const { CronJob } = require('cron');
// Import routes
const flagHistoryRoutes = require('./routes/flagHistory');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const userRoutes = require('./routes/user');
const dealbreakerRoutes = require('./routes/dealbreaker');
const User = require('./models/User');
// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for file uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Passport middleware
app.use(passport.initialize());

// Passport config
require('./config/passport')(passport);

// Connect to MongoDB
mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => console.log('Connected to MongoDB Atlas'))
	.catch((err) => console.error('Could not connect to MongoDB:', err));

// Routes
app.use('/api/flagHistory', flagHistoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/user', userRoutes);
app.use('/api/dealbreaker', dealbreakerRoutes);
// Root route
app.get('/', (req, res) => {
	res.json({ message: 'Welcome to Dealbreaker API' });
});

// Cron job to delete guest accounts after 90 days of inactivity
const job = new CronJob(
	'0 0 0 * * *', // cronTime - runs daily at midnight
	async function () {
		try {
			console.log('Running daily cleanup of old guest accounts...');
			const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
			const result = await User.deleteMany({
				role: 'guest',
				created_at: { $lt: cutoffDate },
			});
			console.log(`Deleted ${result.deletedCount} old guest users`);
		} catch (error) {
			console.error('Error during guest account cleanup:', error);
		}
	}, // onTick
	null, // onComplete
	true, // start
	'America/Los_Angeles' // timeZone
);

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
