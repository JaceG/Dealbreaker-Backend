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
				user: req.user.id,
			});
			user.name = name;
			await user.save();
			res.json(user ? user : null);
		} else if (type === 2) {
			const user = await User.findOne({
				user: req.user.id,
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
		} else if (type === 3) {
			await flaghistories.deleteMany({
				creatorId: req.user.id,
			});
			await dealbreakers.deleteMany({
				user: req.user.id,
			});
			await User.deleteOne({
				_id: req.user.id,
			});
			res.json({ message: 'Account deleted' });
		}
		res.status(500).json({ message: 'Invalid type' });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

module.exports = router;
