const mongoose = require('mongoose')
const Schema = mongoose.Schema

const UserSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String
    // Password not required for OAuth users
  },
  googleId: {
    type: String
    // Only for Google OAuth users
  },
  profile_image: {
    type: String
  },
  created_at: {
    type: Date,
    default: Date.now
  }
})

module.exports = mongoose.model('User', UserSchema)
