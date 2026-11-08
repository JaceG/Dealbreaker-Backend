// Fills one account with a demo board: a main list of 43 cards and five people, each with a long history.
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
	['drinks', 'Drinks every night', 'Needs a drink to unwind, every single day.', 'white', 'flag', '2026-01-04'],
	['jealous', 'Jealous of my friends', 'Resents the time I spend with friends.', 'yellow', 'flag', '2026-01-04'],
	['pressureDrink', 'Pressures me to drink', "Keeps pushing after I've said no.", 'yellow', 'flag', '2026-01-04'],
	['notReady', 'Not ready for commitment', '"Seeing where it goes" months in.', 'yellow', 'flag', '2026-01-04'],
	['asksTexting', "Asks who I'm texting", 'Wants to know who every message is from.', 'yellow', 'flag', '2026-10-12'],
	['slowText', 'Slow to text back', 'Takes days to reply, then acts like nothing happened.', 'yellow', 'flag', '2026-01-04'],
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
	['gaslights', '"That never happened"', 'Denies things I know happened, until I doubt myself.', 'red', 'flag', '2026-01-04'],
	['interrupts', 'Talks over me', 'Interrupts or finishes my sentences, usually wrong.', 'yellow', 'flag', '2026-01-04'],
	['moodSwings', 'Unpredictable moods', "Fine one minute, angry the next, and I can't tell why.", 'yellow', 'flag', '2026-01-04'],
	['secretive', 'Secretive with their phone', 'Face-down phone, new passcodes, tilted screens.', 'yellow', 'flag', '2026-01-04'],
	['workaholic', 'Always working', 'Work always wins, and plans get cut short.', 'white', 'flag', '2026-01-04'],
	['futureFaking', 'Big plans, no follow-through', 'Talks about trips and moving in, never makes them happen.', 'yellow', 'flag', '2026-08-30'],
	['hotCold', 'Hot and cold', 'Intense one week, distant the next.', 'yellow', 'flag', '2026-10-02'],
].map(([key, title, description, color, column, created]) => ({ key, title, description, color, column, created }));

// ---- People: [key, name, created, ended?, final colors, cards in their Dealbreakers column] ----
const PEOPLE = [
	{ key: 'avery', name: 'Avery', created: '2026-09-13', colors: { exClose: 'yellow', moveAway: 'yellow' } },
	{
		key: 'sam', name: 'Sam', created: '2026-08-10',
		colors: {
			silentFights: 'red', myFault: 'red', jealous: 'red', moodSwings: 'red', asksTexting: 'red', cantApologize: 'yellow',
			boundaries: 'yellow', phone: 'yellow', gaslights: 'yellow', hotCold: 'yellow', futureFaking: 'yellow',
			loveBomb: 'yellow', badExes: 'yellow', family: 'yellow', vaguePlans: 'yellow', slowText: 'yellow', late: 'yellow',
			drinks: 'yellow', neverAsks: 'yellow', notReady: 'yellow',
		},
	},
	{
		key: 'casey', name: 'Casey', created: '2026-11-01',
		colors: { phone: 'yellow', vaguePlans: 'yellow', slowText: 'yellow', late: 'yellow', loveBomb: 'yellow' },
	},
	{
		key: 'riley', name: 'Riley', created: '2026-01-10', ended: '2026-04-21',
		colors: {
			loveBomb: 'yellow', phone: 'red', smallLies: 'red', vaguePlans: 'red', politics: 'yellow', datingApps: 'red',
			secretive: 'red', gaslights: 'red', slowText: 'yellow', badExes: 'yellow', money: 'yellow', cantApologize: 'red',
			interrupts: 'yellow', drinks: 'yellow', silentFights: 'yellow', jealous: 'yellow', family: 'yellow', moodSwings: 'yellow',
		},
		dealbreakers: ['datingApps'],
	},
	{
		key: 'jordan', name: 'Jordan', created: '2026-05-03', ended: '2026-08-28',
		colors: {
			late: 'yellow', cancels: 'red', notReady: 'red', kids: 'red', workaholic: 'red', slowText: 'red', vaguePlans: 'yellow',
			cantApologize: 'yellow', silentFights: 'yellow', neverAsks: 'yellow', badExes: 'yellow', money: 'yellow',
			interrupts: 'yellow', gaslights: 'yellow',
		},
		dealbreakers: ['kids'],
	},
];

// ---- Changes Jace made by hand while testing (his own history entries already record them; kept on the board) ----
const LIVE_EDITS = [
	{ profile: 'main', card: 'smallLies', color: 'yellow' },
	{ profile: 'main', card: 'smokes', column: 'dealbreaker' },
	{ profile: 'sam', card: 'smokes', color: 'red', column: 'dealbreaker' },
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

	// ---- Round 2 (2026-11-08): longer threads. The same card with the same person over weeks, notes between changes ----
	['main', 'interrupts', '2026-01-04T20:35', 'Y', 'I want to be heard, not talked over.'],
	['main', 'gaslights', '2026-01-04T20:36', 'R', "If I can't trust my own memory around someone, I'm out."],
	['main', 'moodSwings', '2026-01-04T20:37', 'Y', "Walking on eggshells isn't love."],
	['main', 'secretive', '2026-01-04T20:39', 'Y', 'Privacy is fine. Hiding things is different.'],
	['main', 'workaholic', '2026-01-04T20:43', 'note', 'Busy is fine. Never having time for me is not.'],
	['main', 'drinks', '2026-06-15T20:00', 'W', "Realized this was more about my own habits than anyone else's. Taking it down."],
	['main', 'futureFaking', '2026-08-30T10:25', 'Y', "Jordan talked about trips we'd take and never booked one. Adding this."],
	['main', 'slowText', '2026-09-30T20:00', 'Y', 'Third person in a row where this bugged me. Making it official.'],
	['main', 'hotCold', '2026-10-02T21:00', 'Y', "Sam's week of ice cold, then sweet again. Adding this so I stop excusing it."],
	['main', 'phone', '2026-11-07T21:00', 'note', 'Stats show this on everyone. Is it them, or do I expect too much attention at dinner?'],

	// Riley
	['riley', 'loveBomb', '2026-01-12T22:00', 'note', 'Flowers waiting at the restaurant on our first date. Sweet.'],
	['riley', 'late', '2026-01-20T20:30', 'Y', '20 minutes late to our second date, no text.'],
	['riley', 'loveBomb', '2026-01-24T21:00', 'note', "Two weeks in and planning our 'first vacation.'"],
	['riley', 'late', '2026-01-27T19:00', 'note', 'On time, and apologized for last week without me asking.'],
	['riley', 'smallLies', '2026-01-31T22:00', 'note', "Said they'd seen my favorite movie. Clearly hadn't. Harmless?"],
	['riley', 'vaguePlans', '2026-02-01T12:00', 'note', 'Spontaneous Saturday: farmers market, then a hike. Fun.'],
	['riley', 'late', '2026-02-05T20:00', 'W', 'On time three dates in a row. Taking it down.'],
	['riley', 'vaguePlans', '2026-02-08T17:00', 'note', 'No plan for Saturday until 5 PM. Again.'],
	['riley', 'phone', '2026-02-12T21:30', 'note', 'Phone on the table, screen down. Better?'],
	['riley', 'smallLies', '2026-02-19T20:00', 'note', 'The gym story changed twice when I asked about it.'],
	['riley', 'smallLies', '2026-02-27T22:00', 'note', "Third small one this month: said their phone was dead. It wasn't."],
	['riley', 'secretive', '2026-02-28T21:00', 'Y', 'Phone always face down. Flips it over when a text comes in.'],
	['riley', 'phone', '2026-03-04T22:00', 'note', 'Texting through the whole movie.'],
	['riley', 'loveBomb', '2026-03-05T20:00', 'note', 'The grand gestures stopped the week we became exclusive.'],
	['riley', 'vaguePlans', '2026-03-07T18:00', 'note', 'Asked them to plan ahead once in a while. They did: one dinner, booked a week out.'],
	['riley', 'secretive', '2026-03-08T21:30', 'note', 'Tilted the screen away when I sat down next to them.'],
	['riley', 'politics', '2026-03-10T21:00', 'note', 'Tried the conversation again, calmer. Still dismissive.'],
	['riley', 'slowText', '2026-03-12T23:00', 'Y', 'Hours of silence on Saturdays.'],
	['riley', 'gaslights', '2026-03-16T10:00', 'Y', "Insisted they never said they'd be at their brother's. They did. I have the text."],
	['riley', 'phone', '2026-03-19T22:00', 'R', 'The phone comes to the bathroom now. Every time.'],
	['riley', 'gaslights', '2026-03-20T21:00', 'R', 'Did it again about a different night. Twice in one week.'],
	['riley', 'secretive', '2026-03-22T23:00', 'note', "Left the room for a 'work call' at 11 PM on a Saturday."],
	['riley', 'slowText', '2026-03-26T12:00', 'note', 'Always Saturdays. I see the pattern now.'],
	['riley', 'smallLies', '2026-03-28T20:00', 'note', "Each lie is small. Together they're a lot."],
	['riley', 'datingApps', '2026-04-03T21:00', 'note', "Asked about the notification again. 'Old account, can't remember the password.'"],
	['riley', 'secretive', '2026-04-05T22:00', 'R', 'Changed their passcode the day after I saw the app notification.'],
	['riley', 'gaslights', '2026-04-08T22:00', 'note', "'You're paranoid.' I have screenshots."],
	['riley', 'smallLies', '2026-04-10T20:00', 'note', 'I stopped believing the first version of anything they tell me.'],
	['riley', 'datingApps', '2026-04-12T19:00', 'note', "Dani says she saw Riley's profile 'active recently.' I didn't want to believe her."],
	['riley', 'secretive', '2026-04-20T22:00', 'note', 'Looking back, the phone told me everything before Dani did.'],

	['riley', 'badExes', '2026-01-14T22:00', 'note', "Every ex story ends with 'and then she went crazy.' Two so far."],
	['riley', 'money', '2026-01-18T21:00', 'note', 'Insisted on paying for everything the first few dates.'],
	['riley', 'badExes', '2026-01-22T21:00', 'Y', "Third 'crazy ex' story. Watching this."],
	['riley', 'cantApologize', '2026-01-29T20:00', 'note', 'A real apology for being late last week. Nice.'],
	['riley', 'badExes', '2026-02-17T20:00', 'note', 'Ran into one of the exes by accident. She seemed perfectly nice.'],
	['riley', 'money', '2026-02-24T21:00', 'Y', "Borrowed $200 'until Friday.'"],
	['riley', 'cantApologize', '2026-03-02T23:50', 'Y', "After the politics fight: 'I'm sorry you got upset.'"],
	['riley', 'cantApologize', '2026-03-23T21:00', 'note', 'Still no apology for the disappearing weekend.'],
	['riley', 'money', '2026-03-27T20:00', 'note', "Friday was a month ago. Asked about the $200. 'Oh, right.'"],
	['riley', 'badExes', '2026-04-14T21:00', 'note', "Now I get why the exes sound the way they do in Riley's stories."],
	['riley', 'cantApologize', '2026-04-16T22:00', 'R', "Caught lying about the apps. Not one 'sorry.'"],
	['riley', 'money', '2026-04-18T12:00', 'note', 'Got the $200 back. After asking three times.'],

	// Jordan
	['jordan', 'drinks', '2026-05-06T22:00', 'note', 'Two drinks on our first date, then switched to water. Respect.'],
	['jordan', 'neverAsks', '2026-05-13T21:00', 'note', "Asked about my pottery class. Remembered my teacher's name."],
	['jordan', 'drinks', '2026-05-20T19:00', 'Y', 'Third beer by 7 PM at the barbecue.'],
	['jordan', 'cantApologize', '2026-05-26T12:00', 'Y', "No apology for brunch. 'Traffic, what can you do.'"],
	['jordan', 'drinks', '2026-05-27T21:00', 'note', 'Asked about it gently. Said it was a rough week.'],
	['jordan', 'cantApologize', '2026-06-07T20:00', 'note', 'Brought up the brunch thing on their own, days later.'],
	['jordan', 'cantApologize', '2026-06-08T21:00', 'W', 'A real apology, unprompted. Taking it down.'],
	['jordan', 'drinks', '2026-06-25T21:00', 'W', "Haven't seen it since. Taking it down."],
	['jordan', 'silentFights', '2026-07-02T22:00', 'Y', 'Went quiet after the kids conversation. Two days.'],
	['jordan', 'silentFights', '2026-07-06T20:00', 'note', "We talked it through. They said they shut down when it's hard."],
	['jordan', 'neverAsks', '2026-07-22T21:00', 'Y', "Haven't been asked about my week in a while."],
	['jordan', 'cantApologize', '2026-08-07T19:00', 'Y', "Cancelled again and didn't apologize this time."],
	['jordan', 'neverAsks', '2026-08-11T21:00', 'note', 'Every dinner is about the launch.'],
	['jordan', 'silentFights', '2026-08-24T22:00', 'note', "Silent the whole drive home from my sister's."],

	['jordan', 'phone', '2026-05-17T21:00', 'Y', 'Checked fantasy football scores all through dinner.'],
	['jordan', 'late', '2026-05-31T11:00', 'note', 'On time, and brought coffee.'],
	['jordan', 'phone', '2026-06-01T20:00', 'note', 'Put the phone face down as soon as I mentioned it.'],
	['jordan', 'workaholic', '2026-06-10T22:00', 'Y', 'Third date in a row cut short for work calls.'],
	['jordan', 'workaholic', '2026-06-12T10:00', 'note', 'Cancelled brunch for a work thing. Fine, it happens.'],
	['jordan', 'phone', '2026-06-14T20:00', 'W', 'The phone stays in their pocket now. Taking it down.'],
	['jordan', 'notReady', '2026-06-18T23:00', 'note', "Introduced me as 'a friend' at their cousin's party."],
	['jordan', 'late', '2026-06-21T20:30', 'R', '40 minutes late to dinner with my sister. My sister noticed.'],
	['jordan', 'vaguePlans', '2026-06-28T18:00', 'Y', "Weekend plans stay 'tbd' until Saturday."],
	['jordan', 'late', '2026-07-05T12:00', 'note', 'Talked about it. They set alarms for our plans now.'],
	['jordan', 'workaholic', '2026-07-08T21:00', 'note', 'Big launch at work. Said it calms down in August.'],
	['jordan', 'vaguePlans', '2026-07-10T20:00', 'note', 'Planned the beach trip three weeks ahead. Proud of them.'],
	['jordan', 'kids', '2026-07-12T19:00', 'note', 'Jordan held my niece the whole afternoon. Hope.'],
	['jordan', 'workaholic', '2026-07-15T21:00', 'note', "Took a call during my sister's birthday dinner."],
	['jordan', 'cancels', '2026-07-20T19:30', 'note', 'Rescheduled dinner and showed up with flowers.'],
	['jordan', 'slowText', '2026-07-20T12:00', 'Y', 'Days between replies again.'],
	['jordan', 'late', '2026-07-26T12:00', 'Y', 'On time for weeks now. Down to yellow.'],
	['jordan', 'slowText', '2026-07-27T21:00', 'note', 'Says texting feels like work after work.'],
	['jordan', 'slowText', '2026-07-30T22:30', 'R', "Four days, no reply, then 'hey stranger.'"],
	['jordan', 'kids', '2026-08-02T21:00', 'note', "Asked what 'open to it' means. 'Someday, maybe.' Someday when?"],
	['jordan', 'cancels', '2026-08-04T18:00', 'note', 'Cancelled the weekend trip. Work again.'],
	['jordan', 'notReady', '2026-08-05T22:00', 'note', "Asked where this is going. 'Let's just enjoy it.'"],
	['jordan', 'workaholic', '2026-08-12T21:00', 'R', "It didn't calm down."],
	['jordan', 'family', '2026-08-16T20:00', 'note', "My sister asked if Jordan's 'still around.' Hm."],
	['jordan', 'cancels', '2026-08-19T20:00', 'note', "I've stopped making plans that matter to me."],
	['jordan', 'workaholic', '2026-08-20T22:00', 'note', "Said work is 'just how it is' for the next few years."],
	['jordan', 'notReady', '2026-08-22T23:00', 'note', 'Four months. Still no word for what we are.'],

	// Sam
	['sam', 'loveBomb', '2026-08-12T22:00', 'note', 'Huge bouquet on date two. A bit much?'],
	['sam', 'loveBomb', '2026-08-19T22:00', 'Y', "'I've never felt this way about anyone,' in week two."],
	['sam', 'badExes', '2026-08-21T21:00', 'Y', "Called their last two exes 'psychos.'"],
	['sam', 'loveBomb', '2026-08-26T21:00', 'note', "Planning a trip for our 'one-month anniversary.'"],
	['sam', 'family', '2026-09-14T13:00', 'note', 'Met my mom at brunch. Charming.'],
	['sam', 'badExes', '2026-09-24T21:00', 'note', 'An ex texted them. Sam showed me and laughed about her.'],
	['sam', 'family', '2026-10-11T14:00', 'Y', "Skipped my mom's birthday dinner after our fight."],
	['sam', 'badExes', '2026-10-19T21:00', 'note', 'Wondering what Sam tells people about me.'],
	['sam', 'family', '2026-10-25T12:00', 'note', "Mom asked if everything's okay with Sam."],

	['sam', 'phone', '2026-08-24T21:00', 'Y', 'Phone out the whole time at the farmers market.'],
	['sam', 'silentFights', '2026-08-28T22:00', 'note', 'First small disagreement, about where to eat. Sam went quiet for an hour, then fine.'],
	['sam', 'boundaries', '2026-09-02T20:00', 'note', "Told Sam I need one night a week to myself. They said 'of course.'"],
	['sam', 'interrupts', '2026-09-05T20:00', 'Y', 'Finished my sentences for me. Wrong, every time.'],
	['sam', 'jealous', '2026-09-06T21:00', 'note', "Asked who 'Dani' was three times this week."],
	['sam', 'myFault', '2026-09-08T22:00', 'note', 'Sam forgot our plans, and somehow I should have reminded them.'],
	['sam', 'futureFaking', '2026-09-10T21:00', 'Y', "Keeps saying 'we should go to Japan' and changes the subject when I suggest dates."],
	['sam', 'phone', '2026-09-12T21:00', 'note', 'Phone at dinner again. Said it was work.'],
	['sam', 'silentFights', '2026-09-16T21:00', 'note', 'Day two of silence ended with Sam acting like nothing happened.'],
	['sam', 'boundaries', '2026-09-18T23:00', 'note', "Texted 'just checking in' six times on my night off. Let it go."],
	['sam', 'interrupts', '2026-09-19T22:00', 'note', 'Told a story at dinner and Sam finished it. Wrong ending.'],
	['sam', 'moodSwings', '2026-09-20T22:30', 'Y', 'Fine one minute, cold the next. Never says why.'],
	['sam', 'myFault', '2026-09-22T21:00', 'note', "Apologized for being 'too sensitive' about Sam's comment. Why did I apologize?"],
	['sam', 'moodSwings', '2026-09-26T21:00', 'note', "Asked what was wrong. 'Nothing.' Clearly something."],
	['sam', 'silentFights', '2026-09-29T21:00', 'note', 'Silent again after I said no to their work party. One day this time.'],
	['sam', 'moodSwings', '2026-10-02T23:00', 'R', 'Slammed a door after I said I was tired. Scared me a bit.'],
	['sam', 'boundaries', '2026-10-05T22:00', 'note', 'Read my texts over my shoulder. Said it was a joke.'],
	['sam', 'hotCold', '2026-10-06T21:00', 'Y', 'Sweetest person alive on Monday, ice cold by Wednesday.'],
	['sam', 'jealous', '2026-10-08T22:00', 'note', "Skipped girls' night so Sam wouldn't be upset. I regret it."],
	['sam', 'moodSwings', '2026-10-09T20:00', 'note', "Apologized for the door, sort of. 'You know how I get.'"],
	['sam', 'futureFaking', '2026-10-10T21:00', 'note', 'Japan came up again. I asked for dates. Subject changed.'],
	['sam', 'hotCold', '2026-10-13T20:00', 'note', 'Flowers after the cold week. Same cycle as last time.'],
	['sam', 'gaslights', '2026-10-14T20:00', 'Y', "Says the fight on the 11th 'wasn't a big deal' and I'm remembering it wrong."],
	['sam', 'gaslights', '2026-10-16T21:00', 'note', "Showed Sam the texts from the 11th. 'You're taking them out of context.'"],
	['sam', 'asksTexting', '2026-10-17T22:00', 'R', 'Picked up my phone when it buzzed and read the message out loud.'],
	['sam', 'myFault', '2026-10-18T12:00', 'note', "Maya was there for the last one. She said 'you didn't do anything.' I needed to hear that."],
	['sam', 'silentFights', '2026-10-20T21:00', 'note', "Asked Sam to talk instead of going quiet. 'I need space to process.' Fair, if it's hours, not days."],
	['sam', 'moodSwings', '2026-10-21T21:00', 'note', "I'm learning to read the mood before I speak. That's not normal."],
	['sam', 'boundaries', '2026-10-24T18:00', 'note', 'Asked Sam to stop calling my work line. They agreed, sounding annoyed.'],
	['sam', 'interrupts', '2026-10-25T20:00', 'note', 'Better at dinner tonight. Listened the whole time.'],
	['sam', 'cantApologize', '2026-10-26T21:00', 'note', "'I'm sorry, but...' Everything after 'but' cancels it."],
	['sam', 'silentFights', '2026-10-27T20:00', 'note', 'Three days. I counted.'],
	['sam', 'gaslights', '2026-10-28T22:00', 'note', 'Second time this month I doubted my own memory. Keeping notes here for exactly this.'],
	['sam', 'jealous', '2026-10-30T23:30', 'note', "Went to Maya's anyway. Sam texted 14 times."],
	['sam', 'asksTexting', '2026-10-31T21:00', 'note', 'Wanted to read my texts with Maya. I said no. Two-hour argument.'],
	['sam', 'hotCold', '2026-10-31T22:00', 'note', 'Mapped it out: warm after I pull back, cold once I lean in.'],
	['sam', 'moodSwings', '2026-11-01T20:00', 'note', 'Good week. I keep waiting for the drop.'],
	['sam', 'futureFaking', '2026-11-02T21:30', 'note', "Same with meeting their parents: 'soon.'"],
	['sam', 'phone', '2026-11-03T21:00', 'note', 'Was actually present at dinner. Noticed.'],
	['sam', 'myFault', '2026-11-04T21:00', 'note', "Started saying 'I'm not apologizing for that' out loud. Sam hates it."],
	['sam', 'gaslights', '2026-11-05T19:00', 'note', "Maya read my notes. 'This is not you misremembering.'"],
	['sam', 'boundaries', '2026-11-05T21:00', 'note', "Two days of respecting it. I'm grateful for the bare minimum, and I notice that."],
	['sam', 'cantApologize', '2026-11-06T22:00', 'note', 'Sam apologized for the door. A real one, finally. Noting it.'],
	['sam', 'interrupts', '2026-11-07T19:00', 'W', 'Three good dinners in a row. Taking it down.'],
	['sam', 'silentFights', '2026-11-07T22:00', 'note', 'Wrote down every silence since August. Eleven. Two days on average.'],

	// Avery
	['avery', 'slowText', '2026-09-16T21:00', 'note', 'Replies within the hour, sometimes with photos of their dog.'],
	['avery', 'phone', '2026-09-27T21:00', 'Y', 'Answered work emails at dinner.'],
	['avery', 'slowText', '2026-10-03T22:00', 'note', 'Quiet day. A long shift at the hospital; they told me after.'],
	['avery', 'workaholic', '2026-10-08T22:00', 'Y', 'Cancelled Thursday for a double shift.'],
	['avery', 'exClose', '2026-10-09T21:00', 'note', 'Asked about the ex. Two years together, ended mutually, same friend group.'],
	['avery', 'phone', '2026-10-12T20:00', 'note', 'Left their phone in the car before dinner, without me asking.'],
	['avery', 'slowText', '2026-10-15T21:00', 'note', 'We talked about texting. They prefer calls. Trying more calls.'],
	['avery', 'exClose', '2026-10-17T23:00', 'note', 'The ex was at trivia night. A little awkward for me, totally normal for them.'],
	['avery', 'workaholic', '2026-10-19T20:00', 'note', 'Always tells me ahead now, and makes it up on the weekend.'],
	['avery', 'slowText', '2026-10-22T13:00', 'note', 'Called on their lunch break just to say hi.'],
	['avery', 'moveAway', '2026-10-23T21:00', 'note', 'The Denver job is a maybe, not a plan. Final rounds in January.'],
	['avery', 'exClose', '2026-10-26T22:00', 'note', "The ex introduced herself and was lovely. I'm overthinking this."],
	['avery', 'politics', '2026-10-27T21:00', 'note', 'Still disagree on two things, still kind about it.'],
	['avery', 'phone', '2026-10-30T20:00', 'W', "We made a 'no phones at dinner' rule together. They stuck to it. Taking it down."],
	['avery', 'moveAway', '2026-10-31T21:00', 'note', "Talked about what we'd do if it happens. Long distance for a year? Open question."],
	['avery', 'workaholic', '2026-11-02T20:00', 'W', "It's a hard job, not a priority problem. Taking it down."],
	['avery', 'moveAway', '2026-11-03T22:00', 'note', "Asked if I'd ever move. Honestly, maybe."],
	['avery', 'slowText', '2026-11-05T09:00', 'W', 'Weeks of easy texting. Taking it back down.'],
	['avery', 'exClose', '2026-11-06T21:00', 'note', 'Thinking about taking this back to white. Waiting a few more weeks.'],
	['avery', 'moveAway', '2026-11-07T22:00', 'note', "Not letting a 'maybe' in January decide November."],

	// Round 2b: the same cards across more people, so patterns show up
	['riley', 'interrupts', '2026-02-03T22:00', 'Y', 'Talks over me at parties, every time.'],
	['riley', 'interrupts', '2026-02-26T21:00', 'note', "Did it in front of my boss at the work dinner. Mortifying."],
	['riley', 'notReady', '2026-02-15T22:00', 'Y', "Doesn't want labels yet. Six weeks in."],
	['riley', 'notReady', '2026-03-01T21:30', 'W', "We're exclusive now. Taking it down."],
	['riley', 'drinks', '2026-02-21T23:30', 'Y', 'Four drinks every night we go out.'],
	['riley', 'drinks', '2026-03-18T22:00', 'note', 'Drunk texts at 2 AM, then pretends they never happened.'],
	['riley', 'silentFights', '2026-03-03T21:00', 'Y', 'Silent for a whole day after the politics fight.'],
	['riley', 'silentFights', '2026-03-11T20:00', 'note', "Asked to talk instead. 'There's nothing to talk about.'"],
	['riley', 'jealous', '2026-03-14T23:00', 'Y', 'Annoyed I went out with coworkers. From someone who disappears every Saturday.'],
	['riley', 'family', '2026-03-29T18:00', 'Y', 'Skipped Sunday dinner with my family, last minute.'],
	['riley', 'moodSwings', '2026-04-01T22:00', 'Y', 'Snapped at me over dinner, sweet again an hour later.'],

	['jordan', 'badExes', '2026-05-15T21:00', 'Y', "Their ex was 'controlling.' Every story, the same villain."],
	['jordan', 'badExes', '2026-06-03T20:00', 'note', "Heard the ex's side from a mutual friend. It's complicated."],
	['jordan', 'money', '2026-06-30T21:00', 'Y', 'Bought a $900 watch, then asked me to cover dinner.'],
	['jordan', 'money', '2026-07-18T21:00', 'note', 'Third time covering dinner this month.'],
	['jordan', 'interrupts', '2026-07-03T20:00', 'Y', 'Talks over me whenever work comes up.'],
	['jordan', 'gaslights', '2026-08-08T21:00', 'Y', 'Said they never promised the beach trip. They did.'],
	['jordan', 'gaslights', '2026-08-14T21:00', 'note', "'I said maybe.' I have the text that says 'it's booked.'"],

	['sam', 'vaguePlans', '2026-08-31T12:00', 'Y', "'Let's see how I feel' about Saturday."],
	['sam', 'slowText', '2026-09-03T22:00', 'Y', 'Hours without a reply, then 20 texts at once.'],
	['sam', 'late', '2026-09-09T20:00', 'Y', '45 minutes late. Said the bus was slow.'],
	['sam', 'drinks', '2026-09-25T23:00', 'Y', 'Drinks more when we fight.'],
	['sam', 'vaguePlans', '2026-09-27T12:00', 'note', "Plans only happen when they're Sam's idea."],
	['sam', 'late', '2026-09-30T19:00', 'note', 'On time, with flowers. Trying.'],
	['sam', 'slowText', '2026-10-03T21:00', 'note', "Went silent all day, then 'why aren't you answering me?' at night."],
	['sam', 'neverAsks', '2026-10-07T21:00', 'Y', "Talked for an hour about their week. Didn't ask about mine."],
	['sam', 'drinks', '2026-10-22T23:30', 'note', 'Three drinks before dinner. The fight after was worse.'],
	['sam', 'notReady', '2026-10-23T21:00', 'Y', "'Why do we need to define it?' Three months in."],

	['avery', 'vaguePlans', '2026-09-21T20:00', 'Y', "Plans only firm up a day ahead because of the hospital schedule."],
	['avery', 'late', '2026-10-01T20:30', 'Y', 'Late twice this week. Shifts run over.'],
	['avery', 'late', '2026-10-10T19:00', 'W', 'Texts the second they know they will be late now. Taking it down.'],
	['avery', 'vaguePlans', '2026-10-14T19:00', 'W', 'Planned our whole Saturday: the museum, then the taco place I mentioned weeks ago. Taking it down.'],
	['avery', 'cantApologize', '2026-10-20T22:00', 'Y', 'Got defensive when I said a comment stung.'],
	['avery', 'cantApologize', '2026-10-21T19:00', 'W', "Came back the next day: 'You were right, I'm sorry.' Taking it down."],

	['casey', 'late', '2026-11-01T20:00', 'Y', '15 minutes late to the first date. Did text ahead.'],
	['casey', 'loveBomb', '2026-11-03T22:00', 'Y', "A 'can't stop thinking about you' text after one date."],
	['casey', 'loveBomb', '2026-11-06T20:00', 'note', 'Toned down since. Maybe just excited.'],

	// Casey
	['casey', 'slowText', '2026-11-05T22:00', 'Y', 'Took a day and a half to text back after our first date.'],
	['casey', 'slowText', '2026-11-07T09:00', 'note', 'Texted first today. Good sign.'],
	['casey', 'phone', '2026-11-07T20:30', 'note', 'Second date. Phone stayed in their pocket.'],
	['casey', 'vaguePlans', '2026-11-08T09:00', 'note', 'Texted Saturday morning with an actual plan. Nice.'],
];

// ---- Build ids the way the app does, but stable so re-running replaces the same cards ----
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const cardId = (c) => (T(`${c.created}T20:00`).getTime() / 1e6 + (hash(c.key) % 1e6) / 1e3).toFixed(10);
const profileId = (p) => (p.key === 'main' ? 'main' : `profile_${T(`${p.created}T12:00`).getTime()}`);
const byKey = Object.fromEntries(CARDS.map((c) => [c.key, { ...c, id: cardId(c) }]));
const MAIN = { key: 'main', name: 'Main Profile', created: '2026-01-04' };
const profileOf = (k) => (k === 'main' ? MAIN : PEOPLE.find((p) => p.key === k));
const COLOR = { W: 'white', Y: 'yellow', R: 'red' };
const rank = { red: 0, yellow: 1, white: 2 };

// Replays the history from a fresh board and checks it lands on the final board described above.
function buildAndCheck() {
	const fail = (m) => { throw new Error(m); };
	if (CARDS.length !== 43) fail(`expected 43 cards, got ${CARDS.length}`);
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
			// Since update 1 the flag offers the two other colors, so any change is one step.
			if (prev === COLOR[kind]) fail(`already ${prev}: ${where}`);
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

	// Jace's own test changes win over the story (his history entries already cover them).
	for (const e of LIVE_EDITS) {
		const s = state[e.profile]?.[e.card];
		if (!s) fail(`live edit for unknown ${e.profile}/${e.card}`);
		if (e.color) s.color = e.color;
		if (e.column) s.column = e.column;
	}

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
