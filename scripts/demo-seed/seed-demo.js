// Fills one account with a demo board: a main list of 36 cards and five people, each with a history.
//   node scripts/demo-seed/seed-demo.js --check          validate the story only, touch nothing
//   node scripts/demo-seed/seed-demo.js                  back up the account's board, then write the demo
//   node scripts/demo-seed/seed-demo.js --watch=120      re-write the board if a phone overwrites it (minutes)
//   node scripts/demo-seed/seed-demo.js --undo           delete demo history, restore the newest backup
// Writes go to whatever MONGODB_URI in ../../.env points at (production today).
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const EMAIL = process.env.DEMO_EMAIL || 'jace.galloway@gmail.com';
const BACKUPS = path.join(__dirname, 'backups');
const URLS = JSON.parse(fs.readFileSync(path.join(__dirname, 'urls.json'), 'utf8'));
const T = (s) => new Date(`${s}:00-05:00`); // 'YYYY-MM-DDTHH:MM' in Jace's time zone (ignores DST)

// ---- Cards on the main list: [key, title, description, main color, main column, created] ----
const CARDS = [
	['smallLies', 'Small lies', 'Little untruths about where they were or what they did.', 'red', 'flag', '2026-01-04'],
	['cantApologize', "Can't apologize", 'Never says sorry, or says "sorry you feel that way."', 'red', 'flag', '2026-01-04'],
	['rudeStaff', 'Rude to service staff', "How they treat a server is how they'll treat me.", 'red', 'flag', '2026-01-04'],
	['myFault', 'Makes every fight my fault', 'Every disagreement ends with me apologizing.', 'red', 'flag', '2026-01-04'],
	['silentFights', 'Goes silent after fights', 'Stonewalls instead of talking it out.', 'yellow', 'flag', '2026-01-04'],
	['neverAsks', 'Never asks about me', 'Conversations are always about them.', 'yellow', 'flag', '2026-01-04'],
	['loveBomb', 'Love bombing early', 'Huge declarations and gifts in the first few weeks.', 'yellow', 'flag', '2026-01-04'],
	['badExes', 'Talks badly about exes', 'Every ex was "crazy." Look for the common factor.', 'yellow', 'flag', '2026-01-04'],
	['cancels', 'Cancels last minute', 'Bails on plans the same day, more than once.', 'yellow', 'flag', '2026-07-17'],
	['family', 'Rude to my family', 'Dismissive or cold around my family.', 'yellow', 'flag', '2026-01-04'],
	['drinks', 'Drinks every night', 'Needs a drink to unwind, every single day.', 'yellow', 'flag', '2026-01-04'],
	['jealous', 'Jealous of my friends', 'Resents the time I spend with friends.', 'yellow', 'flag', '2026-01-04'],
	['pressureDrink', 'Pressures me to drink', "Keeps pushing after I've said no.", 'yellow', 'flag', '2026-01-04'],
	['notReady', 'Not ready for commitment', '"Seeing where it goes" months in.', 'yellow', 'flag', '2026-01-04'],
	['asksTexting', "Asks who I'm texting", 'Wants to know who every message is from.', 'yellow', 'flag', '2026-10-12'],
	['slowText', 'Slow to text back', 'Takes days to reply, then acts like nothing happened.', 'white', 'flag', '2026-01-04'],
	['vaguePlans', 'Vague about plans', 'Never commits to a time or place; keeps options open.', 'white', 'flag', '2026-01-04'],
	['late', 'Always running late', 'Regularly 20+ minutes late without a heads-up.', 'white', 'flag', '2026-01-04'],
	['forgets', 'Forgets plans', "Doesn't remember what we agreed to.", 'white', 'flag', '2026-01-04'],
	['phone', 'Glued to phone on dates', 'Scrolling through dinner, only half there.', 'white', 'flag', '2026-02-02'],
	['smokes', 'Smokes', "Cigarettes or vaping. Not a dealbreaker, but I'd rather not.", 'white', 'flag', '2026-01-04'],
	['noFriends', 'No close friends', 'No long-term friendships to speak of.', 'white', 'flag', '2026-01-04'],
	['money', 'Careless with money', 'Constant debt, impulse spending, borrowing.', 'white', 'flag', '2026-01-04'],
	['moveAway', 'Wants to move away', 'Planning to leave the city in the next year or two.', 'white', 'flag', '2026-01-04'],
	['dogs', "Doesn't like dogs", 'Biscuit is non-negotiable.', 'white', 'flag', '2026-01-04'],
	['mocks', 'Mocks my interests', 'Makes fun of the things I love.', 'white', 'flag', '2026-01-04'],
	['politics', 'Different politics', 'We see the world differently on big issues.', 'white', 'flag', '2026-01-04'],
	['exClose', 'Still close with their ex', 'Daily contact or unresolved feelings with an ex.', 'white', 'flag', '2026-01-04'],
	['cheating', 'Cheating', 'Physical or emotional. No second chances.', 'white', 'dealbreaker', '2026-01-04'],
	['aggression', 'Physical aggression', 'Any violence, threats, or throwing things.', 'white', 'dealbreaker', '2026-01-04'],
	['controlling', 'Controlling behavior', 'Tracking me, checking my phone, deciding who I see.', 'white', 'dealbreaker', '2026-01-04'],
	['boundaries', 'Disrespects boundaries', "Keeps doing something after I've clearly said no.", 'white', 'dealbreaker', '2026-01-04'],
	['drugs', 'Hard drug use', 'Anything beyond the occasional drink.', 'white', 'dealbreaker', '2026-01-04'],
	['datingApps', 'Still on dating apps', 'Active on the apps after we agreed to be exclusive.', 'white', 'dealbreaker', '2026-01-04'],
	['hidesMe', 'Hides me from friends', "Months in and I've met no one in their life.", 'white', 'dealbreaker', '2026-01-04'],
	['kids', 'Different stance on kids', 'I want kids. They need to want them too.', 'yellow', 'dealbreaker', '2026-01-04'],
].map(([key, title, description, color, column, created]) => ({ key, title, description, color, column, created }));

// ---- People: [key, name, created, ended?, final colors, cards in their Dealbreakers column] ----
const PEOPLE = [
	{ key: 'avery', name: 'Avery', created: '2026-09-13', colors: { slowText: 'yellow', exClose: 'yellow', moveAway: 'yellow' } },
	{
		key: 'sam', name: 'Sam', created: '2026-08-10',
		colors: { silentFights: 'red', myFault: 'red', jealous: 'red', cantApologize: 'yellow', asksTexting: 'yellow', boundaries: 'yellow' },
	},
	{ key: 'casey', name: 'Casey', created: '2026-11-01', colors: { phone: 'yellow', vaguePlans: 'yellow' } },
	{
		key: 'riley', name: 'Riley', created: '2026-01-10', ended: '2026-04-21',
		colors: { loveBomb: 'yellow', phone: 'yellow', smallLies: 'red', vaguePlans: 'red', politics: 'yellow', datingApps: 'red' },
		dealbreakers: ['datingApps'],
	},
	{
		key: 'jordan', name: 'Jordan', created: '2026-05-03', ended: '2026-08-28',
		colors: { late: 'yellow', cancels: 'red', notReady: 'red', kids: 'red' },
		dealbreakers: ['kids'],
	},
];

// ---- History: [profile, card, when, kind, reason, attachments?, newColor?] ----
// kind: 'Y'/'R'/'W' = tap to that color, 'note' = Add Context, 'toDB' / 'toFlag' = drag between columns.
const img = (k) => ({ type: 'image', url: URLS[k], name: `${k}.png` });
const HISTORY = [
	// Main list: why each card matters, and what each relationship taught.
	['main', 'boundaries', '2026-01-04T20:05', 'note', "Writing my boundaries down so I can't talk myself out of them later.", [img('main-boundaries-note')]],
	['main', 'smallLies', '2026-01-04T20:12', 'Y', 'Honesty matters more to me than almost anything.'],
	['main', 'rudeStaff', '2026-01-04T20:14', 'Y', "How someone treats a server tells me who they are."],
	['main', 'rudeStaff', '2026-01-04T20:15', 'R', "Thought about it more. This one's close to a dealbreaker for me."],
	['main', 'silentFights', '2026-01-04T20:18', 'Y', "The silent treatment is how my parents fought. I don't want that."],
	['main', 'neverAsks', '2026-01-04T20:19', 'Y', 'I want someone curious about me.'],
	['main', 'badExes', '2026-01-04T20:21', 'Y', 'If every ex was the problem, the problem might be them.'],
	['main', 'cantApologize', '2026-01-04T20:22', 'Y', 'Everyone messes up. I need someone who can own it.'],
	['main', 'myFault', '2026-01-04T20:24', 'Y', 'Took me years to notice this in my last long relationship.'],
	['main', 'family', '2026-01-04T20:25', 'Y', "My family is a big part of my life."],
	['main', 'drinks', '2026-01-04T20:26', 'Y', "I'm cutting back myself. Don't want to be around it every night."],
	['main', 'jealous', '2026-01-04T20:27', 'Y', 'My friends were here first.'],
	['main', 'pressureDrink', '2026-01-04T20:28', 'Y', "No means no, including 'one more round.'"],
	['main', 'notReady', '2026-01-04T20:29', 'Y', "I'm 33. Not looking for something casual."],
	['main', 'kids', '2026-01-04T20:31', 'Y', 'I want kids in the next five years.'],
	['main', 'politics', '2026-01-04T20:33', 'Y', "Big deal for me. Or I think it is?"],
	['main', 'politics', '2026-03-02T23:40', 'R', 'Political arguments with Riley got ugly. Raising this.'],
	['main', 'loveBomb', '2026-04-21T21:00', 'Y', "Riley said 'I love you' on date three. In hindsight that was a warning, not a compliment."],
	['main', 'smallLies', '2026-04-21T21:05', 'R', "Riley's small lies were the start of the big one. Never brushing these off again.", [img('main-lessons-note')]],
	['main', 'datingApps', '2026-04-21T21:10', 'note', "This is why it's on the list. Riley's timeline has the whole story."],
	['main', 'kids', '2026-08-30T10:15', 'toDB', "Jordan and I lost four months because I didn't ask early. This is a dealbreaker, full stop."],
	['main', 'cancels', '2026-08-30T10:20', 'Y', 'After Jordan. Once is life. Three times in a month is a pattern.'],
	['main', 'cantApologize', '2026-10-12T22:00', 'R', 'Watching Sam do this. A real apology is non-negotiable for me.'],
	['main', 'myFault', '2026-10-12T22:02', 'R', "Seeing this with Sam right now. Raising it."],
	['main', 'asksTexting', '2026-10-12T22:05', 'Y', 'Added this after Sam. Feels like the start of controlling behavior.'],
	['main', 'politics', '2026-10-20T19:30', 'W', "Avery and I disagree on a few things and talk about it kindly. How they disagree matters more than what they think."],

	// Riley: ended because of a dealbreaker (back on the apps while exclusive).
	['riley', 'loveBomb', '2026-01-17T23:10', 'Y', "Said 'I love you' on our third date. Sweet? Or way too fast?"],
	['riley', 'slowText', '2026-01-24T09:00', 'note', 'Honestly great at texting. Good-morning text every day.'],
	['riley', 'phone', '2026-02-02T22:30', 'Y', 'On their phone through most of dinner at Lucia’s. Added this as a new flag.'],
	['riley', 'smallLies', '2026-02-14T23:20', 'Y', "Said they were home from the gym and going to bed. Showed up on Dani's story at Murphy's an hour later.", [img('riley-gym-texts')]],
	['riley', 'vaguePlans', '2026-02-22T18:00', 'Y', "Wouldn't commit to Saturday until Saturday afternoon. Third weekend in a row."],
	['riley', 'notReady', '2026-03-01T21:00', 'note', 'We agreed to be exclusive today. Riley brought it up, which I liked.'],
	['riley', 'politics', '2026-03-02T23:35', 'Y', 'Got heated about the news. Riley got mean about it, not just loud.'],
	['riley', 'smallLies', '2026-03-15T11:20', 'R', "Said they were at their brother's and their phone died. Their brother was texting ME looking for them.", [img('riley-saturday-texts')]],
	['riley', 'vaguePlans', '2026-03-21T20:00', 'R', "Disappeared for the whole weekend again. 'Just needed space.'"],
	['riley', 'datingApps', '2026-03-30T22:15', 'Y', 'Saw a dating-app notification on their phone. Said they forgot to delete it.'],
	['riley', 'datingApps', '2026-04-19T08:30', 'R', 'Dani sent me a screenshot. Riley was active on the apps last night.', [img('riley-friend-screenshot')]],
	['riley', 'datingApps', '2026-04-19T21:00', 'toDB', 'Asked Riley. They admitted it. Ending things.'],

	// Jordan: ended over a life-goals mismatch, after moving the card back and forth.
	['jordan', 'rudeStaff', '2026-05-10T22:00', 'note', 'Tipped 30% and chatted with our server like an old friend.'],
	['jordan', 'late', '2026-05-24T11:30', 'Y', '25 minutes late to brunch, no text.'],
	['jordan', 'kids', '2026-06-02T22:45', 'Y', "Asked about kids. Jordan said they're 'not sure yet.'"],
	['jordan', 'kids', '2026-06-20T23:00', 'toDB', 'Jordan said they never want kids. Moving this to dealbreakers.'],
	['jordan', 'kids', '2026-06-24T21:30', 'toFlag', "Talked again. Jordan said they're open to it and panicked last time. Giving it time.", null, 'white'],
	['jordan', 'family', '2026-06-29T20:00', 'note', 'Met my sister. Jordan was lovely with her kids.'],
	['jordan', 'dogs', '2026-07-04T18:00', 'note', 'Biscuit loves Jordan. Approved.'],
	['jordan', 'cancels', '2026-07-17T17:55', 'Y', 'Cancelled dinner an hour before. Third time this month. New flag.', [img('jordan-raincheck')]],
	['jordan', 'cancels', '2026-07-24T18:10', 'R', 'Cancelled again. Same excuse.'],
	['jordan', 'notReady', '2026-07-30T22:00', 'Y', "'Let's not put labels on it.' Three months in."],
	['jordan', 'kids', '2026-08-09T21:00', 'Y', 'Brought up kids again. Jordan changed the subject.'],
	['jordan', 'notReady', '2026-08-15T23:00', 'R', "Still 'seeing where it goes.' I know where I want it to go."],
	['jordan', 'kids', '2026-08-26T21:40', 'R', "Asked directly. It's a no.", [img('jordan-kids-note')]],
	['jordan', 'kids', '2026-08-26T22:30', 'toDB', 'We want different lives. Ending it, kindly.'],

	// Sam: dating now, a few red flags, one step from a dealbreaker.
	['sam', 'mocks', '2026-08-16T21:00', 'note', 'Sam came to my pottery class with me and actually tried. Cute.'],
	['sam', 'jealous', '2026-08-30T23:30', 'Y', "Sulked all night after I went to Maya's birthday without them."],
	['sam', 'silentFights', '2026-09-14T20:00', 'Y', "Didn't speak to me for two days after a small argument."],
	['sam', 'jealous', '2026-09-27T22:10', 'R', "Said my friends 'don't like them' and asked me to see them less."],
	['sam', 'myFault', '2026-10-11T01:05', 'Y', 'Disagreed with Sam at dinner with friends. Got 1 AM texts saying it was all my fault.', [img('sam-fight-texts')]],
	['sam', 'silentFights', '2026-10-11T01:20', 'R', "Won't talk to me until I apologize. Again.",
		[{ type: 'audio', url: URLS['sam-voice-memo'], name: 'sam-voice-memo.m4a', duration: 12 }]],
	['sam', 'cantApologize', '2026-10-12T19:00', 'Y', "Sam: 'Sorry you took it that way.' That's not an apology."],
	['sam', 'asksTexting', '2026-10-12T21:30', 'Y', 'Asked who I was texting twice during the movie. Added it as a new flag.'],
	['sam', 'myFault', '2026-10-12T21:45', 'R', "Third fight this month that ended with me apologizing for something I didn't do."],
	['sam', 'boundaries', '2026-10-19T09:00', 'Y', '11 missed calls between midnight and 2 AM after I said I needed a night to myself.', [img('sam-missed-calls')]],
	['sam', 'boundaries', '2026-10-29T12:30', 'note', 'Showed up at my office after I asked them not to.', [img('sam-office-texts')]],
	['sam', 'boundaries', '2026-11-02T20:00', 'note', 'Told Sam clearly: the next time a boundary gets crossed, I’m done. One more and this goes red.'],
	['sam', 'silentFights', '2026-11-06T21:00', 'note', 'Talked it through with Maya. Giving it two more weeks, max.'],

	// Avery: dating now, going well. Only yellows, lots of notes.
	['avery', 'neverAsks', '2026-09-13T22:00', 'note', "First date at the bookstore café. Asked me a ton of questions and remembered my sister's name later."],
	['avery', 'rudeStaff', '2026-09-20T21:30', 'note', 'Super patient when the restaurant lost our reservation.'],
	['avery', 'slowText', '2026-09-23T22:00', 'Y', 'Went quiet for two days.'],
	['avery', 'slowText', '2026-09-24T19:35', 'note', 'Apologized without me asking and called instead. Good sign.', [img('avery-sorry-texts')]],
	['avery', 'exClose', '2026-10-05T23:00', 'Y', 'Their ex is in their friend group. Met them at a party. Friendly, nothing weird. Watching it.'],
	['avery', 'politics', '2026-10-11T22:00', 'note', 'We disagree on a couple of big things. Talked for two hours and it was a good conversation.'],
	['avery', 'moveAway', '2026-10-18T20:00', 'Y', 'Might take a job in Denver next year. Too early to know what that means for us.'],
	['avery', 'kids', '2026-10-21T22:30', 'note', 'Asked about kids on date four, like I promised myself. Avery wants them too.'],
	['avery', 'neverAsks', '2026-10-25T11:00', 'note', 'Concert last night. Best date so far.',
		[img('avery-tickets'), { type: 'video', url: URLS['avery-concert'], name: 'avery-concert.mp4', duration: 6 }]],
	['avery', 'exClose', '2026-11-01T18:00', 'note', "Avery told me on their own that they'd told their ex we're serious. Appreciated that."],
	['avery', 'slowText', '2026-11-04T21:00', 'note', 'Texting rhythm is good now. Nothing to worry about.'],
	['avery', 'family', '2026-11-07T20:00', 'note', 'Meeting my parents at Thanksgiving. Nervous!'],

	// Casey: brand new.
	['casey', 'phone', '2026-11-01T22:30', 'Y', 'Checked their phone constantly at dinner.'],
	['casey', 'rudeStaff', '2026-11-01T22:32', 'note', 'Really kind to the bartender.'],
	['casey', 'vaguePlans', '2026-11-06T19:00', 'Y', "'Let's play it by ear' for the weekend. Not sure yet."],
];

// ---- Build ids the way the app does, but stable so re-running replaces the same cards ----
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const cardId = (c) => (T(`${c.created}T20:00`).getTime() / 1e6 + (hash(c.key) % 1e6) / 1e3).toFixed(10);
const profileId = (p) => (p.key === 'main' ? 'main' : `profile_${T(`${p.created}T12:00`).getTime()}`);
const byKey = Object.fromEntries(CARDS.map((c) => [c.key, { ...c, id: cardId(c) }]));
const MAIN = { key: 'main', name: 'Main Profile', created: '2026-01-04' };
const profileOf = (k) => (k === 'main' ? MAIN : PEOPLE.find((p) => p.key === k));
const NEXT = { white: 'yellow', yellow: 'red', red: 'white' };
const COLOR = { W: 'white', Y: 'yellow', R: 'red' };
const rank = { red: 0, yellow: 1, white: 2 };

// Replays the history from a fresh board and checks it lands on the final board described above.
function buildAndCheck() {
	const fail = (m) => { throw new Error(m); };
	if (CARDS.length !== 36) fail(`expected 36 cards, got ${CARDS.length}`);
	const state = {}; // profile -> card -> {color, column}
	const mainDB = new Set(CARDS.filter((c) => c.column === 'dealbreaker' && c.key !== 'kids').map((c) => c.key));
	for (const p of [MAIN, ...PEOPLE]) {
		state[p.key] = {};
		for (const c of CARDS)
			state[p.key][c.key] = { color: 'white', column: p.key === 'main' && mainDB.has(c.key) ? 'dealbreaker' : 'flag' };
	}
	const docs = [];
	const sorted = HISTORY.map((h, i) => ({ h, i, at: T(h[2]) })).sort((a, b) => a.at - b.at || a.i - b.i);
	for (const { h, at } of sorted) {
		const [pk, ck, , kind, reason, attachments, toColor] = h;
		const p = profileOf(pk), c = byKey[ck], s = state[pk]?.[ck];
		const where = `${pk}/${ck} ${h[2]}`;
		if (!p || !c || !s) fail(`unknown profile or card: ${where}`);
		if (at < T(`${c.created}T00:00`) || at < T(`${p.created}T00:00`)) fail(`before creation: ${where}`);
		if (p.ended && at > T(`${p.ended}T23:59`)) fail(`after the end: ${where}`);
		let prev = s.color, next = prev, prevType = 'flag', newType = 'flag';
		if (COLOR[kind]) {
			if (s.column !== 'flag') fail(`dealbreaker cards have no flag to tap: ${where}`);
			if (NEXT[prev] !== COLOR[kind]) fail(`tap goes ${prev} -> ${NEXT[prev]}, not ${COLOR[kind]}: ${where}`);
			next = COLOR[kind];
		} else if (kind === 'toDB') {
			if (s.column !== 'flag') fail(`already a dealbreaker: ${where}`);
			s.column = 'dealbreaker'; [prevType, newType] = ['flag', 'dealbreaker'];
			if (pk === 'main') mainDB.add(ck);
		} else if (kind === 'toFlag') {
			if (s.column !== 'dealbreaker') fail(`not a dealbreaker: ${where}`);
			const expected = pk !== 'main' && mainDB.has(ck) ? 'yellow' : 'white';
			if (toColor !== expected) fail(`app would make it ${expected}: ${where}`);
			s.column = 'flag'; next = expected; [prevType, newType] = ['dealbreaker', 'flag'];
		} else if (kind !== 'note') fail(`unknown kind ${kind}: ${where}`);
		s.color = next;
		docs.push({
			profileId: profileId(p), profileName: p.name, flagId: c.id, flagTitle: c.title, timestamp: at,
			previousStatus: prev, newStatus: next, reason,
			attachments: (attachments || []).map((a) => ({ ...a, timestamp: at.toISOString() })),
			cardTypeChange: prevType === newType ? 'none' : `${prevType}-to-${newType}`,
			previousCardType: prevType, newCardType: newType,
		});
	}
	// Final state must match the board below, card for card.
	for (const c of CARDS) {
		const s = state.main[c.key];
		if (s.color !== c.color || s.column !== c.column) fail(`main/${c.key} ends ${s.color}/${s.column}, board says ${c.color}/${c.column}`);
	}
	for (const p of PEOPLE)
		for (const c of CARDS) {
			const s = state[p.key][c.key];
			const want = { color: p.colors[c.key] || 'white', column: (p.dealbreakers || []).includes(c.key) ? 'dealbreaker' : 'flag' };
			if (s.color !== want.color || s.column !== want.column)
				fail(`${p.key}/${c.key} ends ${s.color}/${s.column}, board says ${want.color}/${want.column}`);
		}
	if (Object.values(URLS).some((u) => !/^https:\/\//.test(u))) fail('an attachment URL is missing');

	// The board blob the app saves: { profileId: { name, flag: [...], dealbreaker: [...] } }, worst flags first.
	const item = (c, color) => ({ id: byKey[c.key].id, title: c.title, description: c.description, flag: color });
	const board = {};
	for (const p of [MAIN, ...PEOPLE]) {
		const cards = CARDS.map((c) => ({ c, ...state[p.key][c.key] }));
		const col = (name) => cards.filter((x) => x.column === name).sort((a, b) => rank[a.color] - rank[b.color]).map((x) => item(x.c, x.color));
		board[profileId(p)] = { ...(p.key === 'main' ? {} : { name: p.name }), ...(p.ended ? { ended: true } : {}), flag: col('flag'), dealbreaker: col('dealbreaker') };
	}
	return { board, docs };
}

const isDemoBoard = (b) => b && PEOPLE.every((p) => b[profileId(p)]);

async function main() {
	const { board, docs } = buildAndCheck();
	const counts = Object.entries(board).map(([id, v]) => `${v.name || 'Main'}: ${v.flag.length} flags / ${v.dealbreaker.length} dealbreakers`);
	console.log(`story checks out: ${docs.length} history entries\n  ${counts.join('\n  ')}`);
	const arg = process.argv[2] || '';
	if (arg === '--check') return;

	await mongoose.connect(process.env.MONGODB_URI);
	const db = mongoose.connection.db;
	console.log('database host:', mongoose.connection.host);
	const user = await db.collection('users').findOne({ email: EMAIL });
	if (!user) throw new Error(`no user ${EMAIL}`);
	const boards = db.collection('dealbreakers'), history = db.collection('flaghistories');
	const existing = await boards.findOne({ user: user._id });

	if (arg === '--undo') {
		const files = fs.existsSync(BACKUPS) ? fs.readdirSync(BACKUPS).sort() : [];
		if (!files.length) throw new Error('no backup to restore');
		const saved = JSON.parse(fs.readFileSync(path.join(BACKUPS, files[0]), 'utf8')); // oldest = the board before any demo
		const del = await history.deleteMany({ creatorId: user._id, demoSeed: true });
		await boards.updateOne({ user: user._id }, { $set: { dealbreakers: saved.dealbreakers } });
		console.log(`removed ${del.deletedCount} demo history entries, restored ${files[0]}`);
		return mongoose.disconnect();
	}

	if (arg.startsWith('--watch')) {
		const minutes = Number(arg.split('=')[1] || 120);
		const end = Date.now() + minutes * 60e3;
		console.log(`watching the board for ${minutes} minutes`);
		while (Date.now() < end) {
			const now = await boards.findOne({ user: user._id });
			if (!isDemoBoard(now?.dealbreakers)) {
				await boards.updateOne({ user: user._id }, { $set: { dealbreakers: board } }, { upsert: true });
				console.log(new Date().toISOString(), 'board was overwritten (profiles:', Object.keys(now?.dealbreakers || {}).length, ') - restored the demo');
			}
			await new Promise((r) => setTimeout(r, 15e3));
		}
		return mongoose.disconnect();
	}

	// Seed: back up whatever is there first, unless it is already the demo.
	if (existing && !isDemoBoard(existing.dealbreakers)) {
		fs.mkdirSync(BACKUPS, { recursive: true });
		const file = path.join(BACKUPS, `board-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
		fs.writeFileSync(file, JSON.stringify(existing, null, 2));
		console.log('backed up the old board to', path.relative(process.cwd(), file));
	}
	const del = await history.deleteMany({ creatorId: user._id, demoSeed: true });
	const stamp = { userId: null, userFullName: '', userEmail: '', creatorId: user._id, creatorName: user.name, creatorEmail: user.email, __v: 0, demoSeed: true };
	await history.insertMany(docs.map((d) => ({ ...d, ...stamp })));
	await boards.updateOne({ user: user._id }, { $set: { dealbreakers: board } }, { upsert: true });
	console.log(`replaced ${del.deletedCount} old demo entries with ${docs.length}; board written`);
	await mongoose.disconnect();
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
