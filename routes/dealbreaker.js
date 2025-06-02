const express = require('express')
const router = express.Router()
const Dealbreaker = require('../models/Dealbreaker')

router.post('/get-dealbreakers', async (req, res) => {
  const { id } = req.body
  try {
    const dealbreakers = await Dealbreaker.findOne({
      user: id
    })
    console.log('dealbreakers: ', dealbreakers)
    res.json(dealbreakers.dealbreakers)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

router.post('/add-dealbreaker', async (req, res) => {
  console.log('add-dealbreaker')
  try {
    const { dealbreaker, userId } = req.body
    const previousDealbreakers = await Dealbreaker.findOne({
      user: userId
    })
    if (previousDealbreakers) {
      previousDealbreakers.dealbreakers = dealbreaker
      await previousDealbreakers.save()
    } else {
      await Dealbreaker.create({
        user: userId,
        dealbreakers: dealbreaker
      })
    }
    res.json({ message: 'Dealbreaker added' })
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message })
  }
})

module.exports = router
