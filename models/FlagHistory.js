const mongoose = require('mongoose')

const flagHistorySchema = new mongoose.Schema({
  profileId: {
    type: String,
    required: true,
    index: true
  },
  profileName: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  userFullName: {
    type: String,
    default: ''
  },
  userEmail: {
    type: String,
    default: ''
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  creatorName: {
    type: String,
    default: ''
  },
  creatorEmail: {
    type: String,
    default: ''
  },
  flagId: {
    type: String,
    required: true,
    index: true
  },
  flagTitle: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  previousStatus: {
    type: String,
    required: true,
    enum: ['white', 'yellow', 'red']
  },
  newStatus: {
    type: String,
    required: true,
    enum: ['white', 'yellow', 'red']
  },
  reason: {
    type: String,
    default: ''
  },
  attachments: {
    type: Array,
    default: []
  },
  // Track flag/dealbreaker transitions
  cardTypeChange: {
    type: String,
    enum: ['none', 'flag-to-dealbreaker', 'dealbreaker-to-flag'],
    default: 'none'
  },
  previousCardType: {
    type: String,
    enum: ['flag', 'dealbreaker', 'none'],
    default: 'none'
  },
  newCardType: {
    type: String,
    enum: ['flag', 'dealbreaker', 'none'],
    default: 'none'
  }
})

// Create compound index for efficient queries
flagHistorySchema.index({ profileId: 1, flagId: 1 })

const FlagHistory = mongoose.model('FlagHistory', flagHistorySchema)

module.exports = FlagHistory
