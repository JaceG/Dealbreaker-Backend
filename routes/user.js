const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const User = require('../models/User')
const Profile = require('../models/Profile')
const Flag = require('../models/Flag')

// @route   GET /api/user/data/:userId
// @desc    Get all user data including profiles and flags
// @access  Private
router.get('/data/:userId', auth, async (req, res) => {
  try {
    // Verify the requesting user is the same as the target user
    if (req.user.id !== req.params.userId) {
      return res
        .status(403)
        .json({ message: 'Unauthorized access to user data' })
    }

    // Get all profiles for the user
    const profiles = await Profile.find({ user: req.params.userId })

    // Get all flags for the user
    const flagsArray = await Flag.find({ user: req.params.userId })

    // Convert flags array to the expected format
    // Group flags by profileId
    const flags = {}

    // Initialize with an empty main profile if needed
    flags.main = {
      flag: [],
      dealbreaker: []
    }

    // Process all flags and group them by profile and type
    flagsArray.forEach(flag => {
      const profileId = flag.profileId || 'main'

      // Initialize profile if it doesn't exist
      if (!flags[profileId]) {
        flags[profileId] = {
          flag: [],
          dealbreaker: []
        }
      }

      // Add flag to the appropriate collection based on its type
      const flagType = flag.type === 'dealbreaker' ? 'dealbreaker' : 'flag'
      flags[profileId][flagType].push({
        id: flag._id,
        title: flag.title,
        description: flag.description,
        flag: flag.severity, // 'yellow', 'red', etc.
        createdAt: flag.createdAt,
        updatedAt: flag.updatedAt,
        type: flag.type || 'flag'
      })
    })

    // Return both profiles and flags
    return res.json({
      profiles,
      flags
    })
  } catch (err) {
    console.error('Error fetching user data:', err)
    return res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
