const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const flaghistories = require('../models/FlagHistory');
const dealbreakers = require('../models/Dealbreaker');
const auth = require('../middleware/auth');
const { verifyIdToken } = require('../utils/verifySocialToken');
const {
	PROVIDER_FIELD,
	moveLegacyAppleId,
	hasRealPassword,
	describeSignInMethods,
} = require('../utils/signInMethods');

const fail = (res, status, msg) =>
	res.status(status).json({ errors: [{ msg }] });

router.post('/', auth, async (req, res) => {
	try {
		const { type, name, oldPassword, newPassword } = req.body;
		if (type === 1) {
			const user = await User.findById(req.user.id);
			user.name = name;
			await user.save();
			res.json(user ? user : null);
			return;
		} else if (type === 2) {
			if (typeof newPassword !== 'string' || newPassword.length < 6) {
				return fail(
					res,
					400,
					'Please enter a password with 6 or more characters'
				);
			}
			const user = await User.findById(req.user.id);
			// Accounts without a real password can set one without the old one.
			if (await hasRealPassword(user)) {
				const isMatch = await bcrypt.compare(
					oldPassword || '',
					user.password
				);

				if (!isMatch) {
					return res
						.status(422)
						.json({ errors: [{ msg: 'Password is incorrect' }] });
				}
			}
			const salt = await bcrypt.genSalt(10);
			user.password = await bcrypt.hash(newPassword, salt);
			await user.save();
			res.json(user ? user : null);
			return;
		} else if (type === 3) {
			await flaghistories.deleteMany({
				creatorId: req.user.id,
			});
			await dealbreakers.deleteMany({
				user: req.user.id,
			});
			await User.findByIdAndDelete(req.user.id);
			res.json({ message: 'Account deleted' });
			return;
		}
		res.status(500).json({ message: 'Invalid type' });
		return;
	} catch (error) {
		res.status(500).json({ message: error.message });
		return;
	}
});

// @route   GET api/myAccount/signInMethods
// @desc    List the ways this account can sign in
router.get('/signInMethods', auth, async (req, res) => {
	try {
		const user = await User.findById(req.user.id);
		if (!user) return fail(res, 404, 'Account not found');
		moveLegacyAppleId(user);
		if (user.isModified()) await user.save();
		res.json(await describeSignInMethods(user));
	} catch (error) {
		console.error(error.message);
		fail(res, 500, 'Server error');
	}
});

// @route   POST api/myAccount/connect
// @desc    Connect a Google or Apple account, proven by a fresh identity token
router.post('/connect', auth, async (req, res) => {
	const { type, idToken } = req.body;
	const field = PROVIDER_FIELD[type];
	if (!field || !idToken)
		return fail(res, 400, 'Sign-in type and identity token are required');
	let verified;
	try {
		verified = await verifyIdToken(type, idToken);
	} catch (err) {
		console.error(`${type} connect rejected:`, err.message);
		return fail(res, 401, 'Sign-in could not be verified');
	}
	try {
		const verifiedEmail =
			verified.email || `${verified.sub}@privaterelay.appleid.com`;
		// Sign-in with this provider account would land on any account that matches it.
		const matches = [{ [field]: verified.sub }, { email: verifiedEmail }];
		if (type === 'apple') matches.push({ googleId: verified.sub });
		const owner = await User.findOne({
			_id: { $ne: req.user.id },
			$or: matches,
		});
		if (owner) {
			const provider = type === 'google' ? 'Google' : 'Apple';
			return fail(
				res,
				409,
				`This ${provider} account already belongs to another Dealbreaker account.`
			);
		}
		const user = await User.findById(req.user.id);
		if (!user) return fail(res, 404, 'Account not found');
		moveLegacyAppleId(user);
		user[field] = verified.sub;
		await user.save();
		res.json(await describeSignInMethods(user));
	} catch (error) {
		console.error(error.message);
		fail(res, 500, 'Server error');
	}
});

// @route   POST api/myAccount/disconnect
// @desc    Disconnect Google or Apple, keeping at least one way to sign in
router.post('/disconnect', auth, async (req, res) => {
	const field = PROVIDER_FIELD[req.body.type];
	if (!field) return fail(res, 400, 'Sign-in type is required');
	try {
		const user = await User.findById(req.user.id);
		if (!user) return fail(res, 404, 'Account not found');
		moveLegacyAppleId(user);
		const methods = await describeSignInMethods(user);
		if (!user[field])
			return fail(res, 400, 'That account is not connected');
		if (methods.hasPassword + methods.google + methods.apple < 2) {
			return fail(
				res,
				400,
				'Add another way to sign in before disconnecting this one.'
			);
		}
		user[field] = null;
		await user.save();
		res.json(await describeSignInMethods(user));
	} catch (error) {
		console.error(error.message);
		fail(res, 500, 'Server error');
	}
});

module.exports = router;
