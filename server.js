require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const passport = require('passport')

// Import routes
const flagHistoryRoutes = require('./routes/flagHistory')
const authRoutes = require('./routes/auth')
const uploadRoutes = require('./routes/upload')
const userRoutes = require('./routes/user')
const dealbreakerRoutes = require('./routes/dealbreaker')
// Create Express app
const app = express()

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' })) // Increased limit for file uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Passport middleware
app.use(passport.initialize())

// Passport config
require('./config/passport')(passport)

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('Could not connect to MongoDB:', err))

// Routes
app.use('/api/flagHistory', flagHistoryRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/user', userRoutes)
app.use('/api/dealbreaker', dealbreakerRoutes)
// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Dealbreaker API' })
})

// Start server
const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
