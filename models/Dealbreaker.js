const mongoose = require('mongoose')
const Schema = mongoose.Schema

const DealbreakerSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dealbreakers: {
    type: Object,
    required: true
  }
})

module.exports = mongoose.model('Dealbreakers', DealbreakerSchema)
