const express = require("express");
const router = express.Router();
const Dealbreaker = require("../models/Dealbreaker");
const auth = require("../middleware/auth");

// The board owner comes from the login token; ids in the body are ignored.
router.use(auth);

router.post("/get-dealbreakers", async (req, res) => {
  try {
    const dealbreakers = await Dealbreaker.findOne({
      user: req.user.id,
    });
    res.json(dealbreakers ? dealbreakers.dealbreakers : null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/add-dealbreaker", async (req, res) => {
  console.log("add-dealbreaker");
  try {
    const { dealbreaker } = req.body;
    const userId = req.user.id;
    const previousDealbreakers = await Dealbreaker.findOne({
      user: userId,
    });
    if (previousDealbreakers) {
      previousDealbreakers.dealbreakers = dealbreaker;
      await previousDealbreakers.save();
    } else {
      await Dealbreaker.create({
        user: userId,
        dealbreakers: dealbreaker,
      });
    }
    res.json({ message: "Dealbreaker added" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
