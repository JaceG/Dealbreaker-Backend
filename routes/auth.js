const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const passport = require('passport')
const { check, validationResult } = require('express-validator')
const User = require('../models/User')
const auth = require('../middleware/auth')
const axios = require('axios')

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post(
  '/register',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check(
      'password',
      'Please enter a password with 6 or more characters'
    ).isLength({ min: 6 })
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { name, email, password } = req.body

    try {
      // Check if user exists
      let user = await User.findOne({ email })

      if (user) {
        return res
          .status(400)
          .json({ errors: [{ msg: 'User already exists' }] })
      }

      user = new User({
        name,
        email,
        password
      })

      // Hash password
      const salt = await bcrypt.genSalt(10)
      user.password = await bcrypt.hash(password, salt)

      await user.save()

      // Return jsonwebtoken
      const payload = {
        user: {
          id: user.id
        }
      }

      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '24h' },
        (err, token) => {
          if (err) throw err
          res.json({ token })
        }
      )
    } catch (err) {
      console.error(err.message)
      res.status(500).send('Server error')
    }
  }
)

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { email, password } = req.body

    try {
      // Check if user exists
      let user = await User.findOne({ email })

      if (!user) {
        return res
          .status(400)
          .json({ errors: [{ msg: 'Invalid Credentials' }] })
      }

      // Check if password matches
      const isMatch = await bcrypt.compare(password, user.password)

      if (!isMatch) {
        return res
          .status(400)
          .json({ errors: [{ msg: 'Invalid Credentials' }] })
      }

      // Return jsonwebtoken
      const payload = {
        user: {
          id: user.id
        }
      }

      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '24h' },
        (err, token) => {
          if (err) throw err
          res.json({ token })
        }
      )
    } catch (err) {
      console.error(err.message)
      res.status(500).send('Server error')
    }
  }
)

// @route   GET api/auth/user
// @desc    Get authenticated user
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password')
    res.json(user)
  } catch (err) {
    console.error(err.message)
    res.status(500).send('Server Error')
  }
})

// @route   GET api/auth/google
// @desc    Google OAuth login
// @access  Public
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

// @route   GET api/auth/google/callback
// @desc    Google OAuth callback
// @access  Public
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Create JWT token
    const payload = {
      user: {
        id: req.user.id
      }
    }

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err
        // Redirect to frontend with token
        res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${token}`)
      }
    )
  }
)

// @route   POST api/auth/google-token
// @desc    Login or register with Google OAuth token from mobile app
// @access  Public
router.post('/google-token', async (req, res) => {
  const { accessToken, idToken } = req.body

  if (!accessToken && !idToken) {
    return res.status(400).json({
      errors: [{ msg: 'Either access token or ID token is required' }]
    })
  }

  try {
    // For iOS, we can verify the token with Google
    let googleUserInfo

    if (accessToken) {
      // Verify with access token (old method)
      googleUserInfo = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      )
    } else {
      // Verify ID token (more secure for mobile)
      // We don't need the client secret for this verification
      googleUserInfo = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
      )
    }

    // Validate the audience (client ID) if using ID token
    if (idToken && googleUserInfo.data.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res
        .status(401)
        .json({ errors: [{ msg: 'Invalid token audience' }] })
    }

    const { sub, name, email, picture } = googleUserInfo.data

    // Check if user exists
    let user = await User.findOne({ email })

    if (!user) {
      // Create new user if doesn't exist
      user = new User({
        googleId: sub,
        name,
        email,
        profile_image: picture
      })

      await user.save()
    } else if (!user.googleId) {
      // If user exists but doesn't have googleId, update it
      user.googleId = sub
      user.profile_image = picture || user.profile_image
      await user.save()
    }

    // Return jsonwebtoken
    const payload = {
      user: {
        id: user.id
      }
    }

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err
        res.json({
          token,
          user: { id: user.id, name: user.name, email: user.email }
        })
      }
    )
  } catch (err) {
    console.error('Google token verification error:', err.message)
    res.status(500).json({ errors: [{ msg: 'Server error' }] })
  }
})

module.exports = router
