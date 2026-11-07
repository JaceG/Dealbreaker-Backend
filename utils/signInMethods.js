const bcrypt = require('bcrypt');

const PROVIDER_FIELD = { google: 'googleId', apple: 'appleId' };

// Apple account IDs look like "001234.<hex>.1234"; Google's are all digits.
const isAppleId = (id) => typeof id === 'string' && id.includes('.');

// Accounts created with Apple before 2026-11 kept their Apple ID in googleId. Move it.
const moveLegacyAppleId = (user) => {
	if (!isAppleId(user.googleId)) return;
	if (!user.appleId) user.appleId = user.googleId;
	user.googleId = undefined;
};

// Earlier app versions gave Google and Apple accounts this fixed password, so it isn't a real one.
const hasRealPassword = async (user) =>
	!!user.password &&
	!(await bcrypt.compare('social_login_placeholder', user.password));

const describeSignInMethods = async (user) => ({
	email: user.email,
	hasPassword: await hasRealPassword(user),
	google: !!user.googleId,
	apple: !!user.appleId,
});

module.exports = {
	PROVIDER_FIELD,
	moveLegacyAppleId,
	hasRealPassword,
	describeSignInMethods,
};
