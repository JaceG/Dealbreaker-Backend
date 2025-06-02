const express = require('express')
const router = express.Router()
const FlagHistory = require('../models/FlagHistory')
const User = require('../models/User')
const mongoose = require('mongoose')

// Get all history entries for a flag
router.get('/:profileId/:flagId', async (req, res) => {
  try {
    const { profileId, flagId } = req.params
    const history = await FlagHistory.find({ profileId, flagId })
      .sort({ timestamp: -1 }) // Newest first
      .exec()

    res.json(history)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Add a new history entry
router.post('/', async (req, res) => {
  try {
    console.log('Received data:', JSON.stringify(req.body, null, 2))

    // Extract data with defaults
    const {
      profileId = '',
      profileName = '',
      flagId = '',
      flagTitle = '',
      previousStatus = '',
      newStatus = '',
      reason = '',
      attachments = [],
      creatorId = req.user ? req.user.id : null,
      // Card type transition tracking
      previousCardType = 'none',
      newCardType = 'none'
    } = req.body

    // Validate required fields with better error messages
    if (!profileId) {
      console.log('Validation error: Missing profileId')
      return res.status(400).json({ message: 'profileId is required' })
    }

    if (!profileName) {
      console.log('Validation error: Missing profileName')
      return res.status(400).json({ message: 'profileName is required' })
    }

    if (!flagId) {
      console.log('Validation error: Missing flagId')
      return res.status(400).json({ message: 'flagId is required' })
    }

    if (!flagTitle) {
      console.log('Validation error: Missing flagTitle')
      return res.status(400).json({ message: 'flagTitle is required' })
    }

    // More flexible validation with type conversion if needed
    const cleanPreviousStatus = String(previousStatus).toLowerCase()
    const cleanNewStatus = String(newStatus).toLowerCase()

    if (!['white', 'yellow', 'red'].includes(cleanPreviousStatus)) {
      console.log('Validation error: Invalid previousStatus', previousStatus)
      return res.status(400).json({
        message: 'previousStatus must be white, yellow, or red',
        received: previousStatus
      })
    }

    if (!['white', 'yellow', 'red'].includes(cleanNewStatus)) {
      console.log('Validation error: Invalid newStatus', newStatus)
      return res.status(400).json({
        message: 'newStatus must be white, yellow, or red',
        received: newStatus
      })
    }

    // Determine card type change
    let cardTypeChange = 'none'
    if (previousCardType === 'flag' && newCardType === 'dealbreaker') {
      cardTypeChange = 'flag-to-dealbreaker'
    } else if (previousCardType === 'dealbreaker' && newCardType === 'flag') {
      cardTypeChange = 'dealbreaker-to-flag'
    }

    // Get user information if we have user IDs
    let creatorName = ''
    let creatorEmail = ''
    let userFullName = ''
    let userEmail = ''

    // Look up creator info if we have a creator ID
    if (creatorId) {
      try {
        const creator = await User.findById(creatorId).select('name email')
        if (creator) {
          creatorName = creator.name || ''
          creatorEmail = creator.email || ''
        }
      } catch (err) {
        console.log('Error fetching creator info:', err.message)
      }
    }

    // Look upuserId from profileId if possible
    let userId = null

    try {
      // Try to find a user with this profileId
      const user = await User.findOne({ _id: profileId }).select(
        '_id name email'
      )
      if (user) {
        userId = user._id
        userFullName = user.name || ''
        userEmail = user.email || ''
      }
    } catch (err) {
      console.log('Error fetching profile owner info:', err.message)
    }

    // Create a sanitized document
    const cleanData = {
      profileId: String(profileId),
      profileName: String(profileName),
      flagId: String(flagId),
      flagTitle: String(flagTitle),
      previousStatus: cleanPreviousStatus,
      newStatus: cleanNewStatus,
      reason: String(reason || ''),
      attachments: Array.isArray(attachments) ? attachments : [],
      timestamp: new Date(),
      creatorId: creatorId,
      creatorName: creatorName,
      creatorEmail: creatorEmail,
      userId: userId,
      userFullName: userFullName,
      userEmail: userEmail,
      // Card type transition fields
      cardTypeChange,
      previousCardType,
      newCardType
    }

    // Create and save the history entry
    const historyEntry = new FlagHistory(cleanData)
    const savedEntry = await historyEntry.save()

    console.log('Successfully saved entry:', savedEntry._id)
    res.status(201).json(savedEntry)
  } catch (error) {
    console.error('Error in POST /flagHistory:', error.message)
    if (error.name === 'ValidationError') {
      console.log(
        'Mongoose validation error details:',
        Object.keys(error.errors)
          .map(key => `${key}: ${error.errors[key].message}`)
          .join(', ')
      )
      return res.status(400).json({
        message: 'Validation error',
        details: Object.values(error.errors).map(err => err.message)
      })
    }
    res.status(400).json({ message: error.message })
  }
})

// Add attachment to a history entry
router.post('/:historyId/attachment', async (req, res) => {
  try {
    const { historyId } = req.params
    const { attachment } = req.body

    const result = await FlagHistory.findByIdAndUpdate(
      historyId,
      { $push: { attachments: attachment } },
      { new: true }
    )

    if (!result) {
      return res.status(404).json({ message: 'History entry not found' })
    }

    res.json(result)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// Sync pending changes
router.post('/sync', async (req, res) => {
  try {
    console.log('Received sync request:', JSON.stringify(req.body, null, 2))

    const { changes } = req.body
    // Get creator ID from authenticated user if available
    const creatorId = req.user ? req.user.id : null

    if (!changes || !Array.isArray(changes)) {
      console.log('Validation error: changes is not an array')
      return res.status(400).json({ message: 'changes must be an array' })
    }

    if (changes.length === 0) {
      console.log('No changes to sync')
      return res.json({ success: true, count: 0, results: [] })
    }

    const results = []

    for (const change of changes) {
      if (!change.action) {
        console.log('Validation error: change is missing action')
        continue
      }

      if (change.action === 'addFlagHistory') {
        try {
          // Extract and validate required fields
          const {
            profileId,
            profileName,
            flagId,
            flagTitle,
            previousStatus,
            newStatus,
            timestamp,
            title, // Also look for title field
            // Card type transition tracking
            previousCardType = 'none',
            newCardType = 'none'
          } = change.data

          // Determine card type change
          let cardTypeChange = 'none'
          if (previousCardType === 'flag' && newCardType === 'dealbreaker') {
            cardTypeChange = 'flag-to-dealbreaker'
          } else if (
            previousCardType === 'dealbreaker' &&
            newCardType === 'flag'
          ) {
            cardTypeChange = 'dealbreaker-to-flag'
          }

          // Get the creator ID
          const creatorId = change.data.creatorId || creatorId

          // Get user information if we have user IDs
          let creatorName = ''
          let creatorEmail = ''
          let userFullName = ''
          let userEmail = ''

          // Look up creator info if we have a creator ID
          if (creatorId) {
            try {
              const creator =
                await User.findById(creatorId).select('name email')
              if (creator) {
                creatorName = creator.name || ''
                creatorEmail = creator.email || ''
              }
            } catch (err) {
              console.log('Error fetching creator info:', err.message)
            }
          }

          // Look upuserId from profileId if possible
          let userId = null

          try {
            // Try to find a user with this profileId
            const user = await User.findOne({ _id: profileId }).select(
              '_id name email'
            )
            if (user) {
              userId = user._id
              userFullName = user.name || ''
              userEmail = user.email || ''
            }
          } catch (err) {
            console.log('Error fetching profile owner info:', err.message)
          }

          // Create a sanitized object with validated fields
          const safeData = {
            profileId: String(profileId || ''),
            profileName: String(profileName || 'Unknown Profile'),
            flagId: String(flagId || ''),
            flagTitle: String(flagTitle || title || `Flag ${flagId}`), // Try both flagTitle and title
            previousStatus: String(previousStatus || 'white'),
            newStatus: String(newStatus || 'white'),
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            reason: change.data.reason || '',
            attachments: Array.isArray(change.data.attachments)
              ? change.data.attachments
              : [],
            creatorId: creatorId,
            creatorName: creatorName,
            creatorEmail: creatorEmail,
            userId: userId,
            userFullName: userFullName,
            userEmail: userEmail,
            // Card type transition fields
            cardTypeChange,
            previousCardType,
            newCardType
          }

          console.log('Creating history entry with data:', safeData)
          const historyEntry = new FlagHistory(safeData)
          const savedEntry = await historyEntry.save()
          console.log('Saved entry:', savedEntry._id)
          results.push(savedEntry)
        } catch (error) {
          console.error('Error saving history entry:', error.message)
          if (error.name === 'ValidationError') {
            console.error(
              'Validation errors:',
              Object.keys(error.errors)
                .map(key => `${key}: ${error.errors[key].message}`)
                .join(', ')
            )
          }
        }
      }
    }

    console.log(
      `Successfully processed ${results.length} of ${changes.length} changes`
    )
    res.json({ success: true, count: results.length, results })
  } catch (error) {
    console.error('Error in sync endpoint:', error.message)
    res.status(400).json({ message: error.message })
  }
})

// Filter flag histories by user attributes - as creator or profile owner
router.get('/filter/byUser', async (req, res) => {
  try {
    const { userId, name, email, isCreator } = req.query

    // Find users matching the criteria
    let userQuery = {}

    if (userId) {
      userQuery._id = userId
    }

    if (name) {
      userQuery.name = { $regex: name, $options: 'i' } // Case insensitive search
    }

    if (email) {
      userQuery.email = { $regex: email, $options: 'i' } // Case insensitive search
    }

    // If no filter criteria provided, return empty result
    if (Object.keys(userQuery).length === 0) {
      return res.status(400).json({
        message:
          'At least one filter criteria (userId, name, or email) is required'
      })
    }

    // Find matching users
    const users = await User.find(userQuery).select('_id')

    if (users.length === 0) {
      return res.json({
        message: 'No users found with the given criteria',
        histories: []
      })
    }

    // Extract user IDs
    const userIds = users.map(user => user._id)

    // Find flag histories for these users - either as creators or profile owners
    const query = {}

    // If isCreator is specified, filter by creator or profile owner accordingly
    if (isCreator === 'true') {
      query.creatorId = { $in: userIds }
    } else if (isCreator === 'false') {
      query.userId = { $in: userIds }
    } else {
      // If not specified, check both
      query.$or = [
        { creatorId: { $in: userIds } },
        { userId: { $in: userIds } }
      ]
    }

    const histories = await FlagHistory.find(query).sort({ timestamp: -1 })

    res.json({
      count: histories.length,
      histories
    })
  } catch (error) {
    console.error('Error filtering flag histories by user:', error.message)
    res.status(500).json({ message: error.message })
  }
})

// Advanced filtering with MongoDB aggregation
router.get('/filter/advanced', async (req, res) => {
  try {
    const { userId, creatorId, name, email, flagId, startDate, endDate } =
      req.query

    // Start building the aggregation pipeline
    const pipeline = []

    // If we have user-related filters for the profile owner
    if (userId || name || email) {
      // Stage 1: Lookup users collection for profile owner
      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'profileOwner'
        }
      })

      // Stage 2: Unwind the profileOwner array
      pipeline.push({
        $unwind: {
          path: '$profileOwner',
          preserveNullAndEmptyArrays: true
        }
      })
    }

    // If we have creator-related filters
    if (creatorId || name || email) {
      // Stage 3: Lookup users collection for creators
      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'creatorId',
          foreignField: '_id',
          as: 'creator'
        }
      })

      // Stage 4: Unwind the creator array
      pipeline.push({
        $unwind: {
          path: '$creator',
          preserveNullAndEmptyArrays: true
        }
      })
    }

    // Stage 5: Match on all criteria
    const matchCriteria = {}

    // Profile owner filters
    if (userId) {
      matchCriteria['profileOwner._id'] = mongoose.Types.ObjectId(userId)
    }

    // Creator filters
    if (creatorId) {
      matchCriteria['creator._id'] = mongoose.Types.ObjectId(creatorId)
    }

    // Name filters (check both profile owner and creator)
    if (name) {
      matchCriteria.$or = matchCriteria.$or || []
      matchCriteria.$or.push(
        { 'profileOwner.name': { $regex: name, $options: 'i' } },
        { 'creator.name': { $regex: name, $options: 'i' } }
      )
    }

    // Email filters (check both profile owner and creator)
    if (email) {
      matchCriteria.$or = matchCriteria.$or || []
      matchCriteria.$or.push(
        { 'profileOwner.email': { $regex: email, $options: 'i' } },
        { 'creator.email': { $regex: email, $options: 'i' } }
      )
    }

    // Flag ID filter
    if (flagId) {
      matchCriteria.flagId = flagId
    }

    // Date range filtering
    if (startDate || endDate) {
      matchCriteria.timestamp = {}

      if (startDate) {
        matchCriteria.timestamp.$gte = new Date(startDate)
      }

      if (endDate) {
        matchCriteria.timestamp.$lte = new Date(endDate)
      }
    }

    // Add match stage if we have criteria
    if (Object.keys(matchCriteria).length > 0) {
      pipeline.push({ $match: matchCriteria })
    }

    // Add sorting stage - newest first
    pipeline.push({ $sort: { timestamp: -1 } })

    // Execute the aggregation pipeline
    const histories = await FlagHistory.aggregate(pipeline)

    res.json({
      count: histories.length,
      histories
    })
  } catch (error) {
    console.error('Error in advanced flag history filtering:', error.message)
    res.status(500).json({ message: error.message })
  }
})

module.exports = router
