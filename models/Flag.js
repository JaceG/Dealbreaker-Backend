const mongoose = require('mongoose')
const Schema = mongoose.Schema

const FlagSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  profileId: {
    type: String,
    required: true,
    default: 'main'
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  severity: {
    type: String,
    enum: ['green', 'yellow', 'red'],
    default: 'yellow'
  },
  type: {
    type: String,
    enum: ['flag', 'dealbreaker'],
    default: 'flag'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

module.exports = mongoose.model('Flag', FlagSchema)
