const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const flaghistories = require('../models/FlagHistory');
const dealbreakers = require('../models/Dealbreaker');
const auth = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
	try {
		const { type, name, oldPassword, newPassword } = req.body;
		if (type === 1) {
			const user = await User.findOne({
				user: req.user._id,
			});
			user.name = name;
			await user.save();
			res.json(user ? user : null);
			return;
		} else if (type === 2) {
			const user = await User.findOne({
				user: req.user._id,
			});
			const isMatch = await bcrypt.compare(oldPassword, user.password);

			if (!isMatch) {
				return res
					.status(422)
					.json({ errors: [{ msg: 'Password is incorrect' }] });
			}
			user.password = newPassword;
			await user.save();
			res.json(user ? user : null);
			return;
		} else if (type === 3) {
			await flaghistories.deleteMany({
				creatorId: req.user._id,
			});
			await dealbreakers.deleteMany({
				user: req.user._id,
			});
			await User.deleteOne({
				_id: req.user._id,
			});
			res.json({ message: 'Account deleted' });
			return;
		}
		res.status(500).json({ message: 'Invalid type' });
		return;
	} catch (error) {
		res.status(500).json({ message: error.message });
		return;
	}
	return;
});

module.exports = router;
