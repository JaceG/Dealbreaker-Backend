// Builds the demo attachment images (fake text threads, notes, a call log, a ticket) as PNGs with headless Chrome.
// Run: node scripts/demo-seed/make-assets.js   Output: scripts/demo-seed/assets/*.png
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = path.join(__dirname, 'assets');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(OUT, { recursive: true });

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const base = `*{box-sizing:border-box;margin:0}body{font-family:-apple-system,Helvetica,sans-serif;width:390px;background:#fff;color:#111}`;

const chat = (who, day, msgs) => `<style>${base}
.h{padding:14px;text-align:center;border-bottom:1px solid #e5e5ea;background:#f9f9f9}
.av{width:44px;height:44px;border-radius:50%;background:#b8bcc8;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:18px}
.n{font-size:13px;color:#333}.d{text-align:center;color:#8e8e93;font-size:11px;margin:12px 0 6px}
.w{padding:0 12px 16px;display:flex;flex-direction:column}
.b{max-width:75%;padding:8px 12px;border-radius:18px;font-size:16px;line-height:1.3;margin:2px 0}
.t{background:#e9e9eb;align-self:flex-start}.m{background:#0a84ff;color:#fff;align-self:flex-end}
.s{font-size:11px;color:#8e8e93;margin:6px 0 2px;text-align:center}</style>
<div class="h"><div class="av">${esc(who[0])}</div><div class="n">${esc(who)}</div></div>
<div class="d">${esc(day)}</div><div class="w">${msgs
	.map(([k, t]) => (k === 's' ? `<div class="s">${esc(t)}</div>` : `<div class="b ${k}">${esc(t)}</div>`))
	.join('')}</div>`;

const note = (title, date, lines) => `<style>${base}body{background:#fffdf3}
.p{padding:22px 20px 28px}.ti{font-size:22px;font-weight:700;margin-bottom:4px}.da{color:#a39e8a;font-size:12px;margin-bottom:14px}
ul{padding:0}li{font-size:16px;line-height:1.45;margin:0 0 8px 18px}</style>
<div class="p"><div class="ti">${esc(title)}</div><div class="da">${esc(date)}</div><ul>${lines
	.map((l) => `<li>${esc(l)}</li>`)
	.join('')}</ul></div>`;

const assets = {
	'riley-gym-texts': chat('Riley', 'Sat, Feb 14 · 9:41 PM', [
		['m', 'how was the gym?'],
		['t', 'brutal leg day 😩 home now, going to bed early'],
		['m', 'haha feel better'],
		['s', '10:58 PM'],
		['m', "isn't that you on Dani's story? at Murphy's?"],
		['t', 'oh that was from earlier'],
		['t', 'stopped by after for like 20 min'],
	]),
	'riley-saturday-texts': chat('Riley', 'Sun, Mar 15 · 11:02 AM', [
		['m', 'where did you end up last night? you stopped answering'],
		['t', 'at my brothers, phone died'],
		['m', 'your brother texted me asking if I knew where you were'],
		['t', 'ok I was out with some coworkers'],
		['t', "didn't want you to make it a thing"],
	]),
	'riley-friend-screenshot': chat('Dani', 'Sun, Apr 19 · 8:15 AM', [
		['t', 'ok I hate sending this but'],
		['t', "isn't this Riley?? showed up on the apps for me last night. \"active today\""],
		['t', 'you two said you were exclusive right?'],
		['m', 'yeah. since March 1'],
		['m', 'thank you for telling me'],
	]),
	'jordan-raincheck': chat('Jordan', 'Thu, Jul 17 · 5:48 PM', [
		['t', 'hey can we raincheck tonight? something came up 😕'],
		['m', 'again? that’s the 3rd time this month'],
		['t', 'I know I know. next week for sure'],
		['s', 'Thu, Jul 24 · 6:05 PM'],
		['t', "ugh work ran late, can't make it"],
	]),
	'jordan-kids-note': note('Talk with Jordan', 'August 26, 2026', [
		'Asked straight out: kids, yes or no.',
		'Jordan: "honestly no. I thought I might change my mind. I haven\'t."',
		'I want kids within ~5 years. This is not a compromise thing.',
		'No fight. We both cried a bit. Agreed to end it.',
		'Lesson: ask this by date 3, not month 3.',
	]),
	'main-lessons-note': note('What Riley taught me', 'April 21, 2026', [
		'The small lies came first (gym, Saturday). I explained them away.',
		'"Didn\'t want you to make it a thing" = I\'m going to keep doing it.',
		'Trust the pattern, not the apology.',
		'Small lies are now RED on my main list.',
		'Not on the apps after we agree to be exclusive = dealbreaker.',
	]),
	'main-boundaries-note': note('My boundaries', 'January 4, 2026', [
		'Don\'t show up at my work or home unannounced.',
		'My phone is mine. No going through it, no demanding passwords.',
		'If I say I need a night to cool off, that\'s respected.',
		'No pressure to drink when I say I\'m not.',
		'My friends stay my friends.',
	]),
	'sam-fight-texts': chat('Sam', 'Sat, Oct 11 · 12:47 AM', [
		['t', 'why do you always do this'],
		['t', 'you made me look stupid in front of everyone'],
		['m', 'I said I disagreed with you. that was it'],
		['t', "this is on you. don't turn it around"],
		['t', "I'm not talking to you until you apologize"],
	]),
	'sam-office-texts': chat('Sam', 'Wed, Oct 29 · 12:10 PM', [
		['t', "I'm outside your office"],
		['t', 'come down, I brought lunch'],
		['m', 'Sam I asked you not to come to my work'],
		['t', 'wow ok. I was being nice'],
		['m', 'I know. but I asked. please respect that'],
	]),
	'avery-sorry-texts': chat('Avery', 'Wed, Sep 24 · 7:30 PM', [
		['t', 'sorry I went quiet the last couple days. crazy week at work'],
		['t', 'not an excuse. can I call you tonight instead of texting?'],
		['m', 'yes please 🙂'],
		['t', 'calling at 8!'],
	]),
};

// A call log and a ticket need their own markup.
assets['sam-missed-calls'] = `<style>${base}
.h{font-size:28px;font-weight:700;padding:18px 16px 8px}.r{display:flex;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #eee}
.r b{color:#ff3b30;font-weight:500}.r span{color:#8e8e93;font-size:14px}</style><div class="h">Recents</div>
${[['Sam (11)', '1:52 AM'], ['Sam (4)', '12:58 AM'], ['Sam', '12:31 AM'], ['Mom', 'Yesterday']]
	.map(([n, t], i) => `<div class="r">${i < 3 ? `<b>${n}</b>` : n}<span>${i < 3 ? 'missed · ' : ''}${t}</span></div>`)
	.join('')}`;
assets['avery-tickets'] = `<style>${base}body{background:#1d1b2f;color:#fff;padding:20px}
.t{border:2px dashed #8f88ff;border-radius:14px;padding:18px}.a{font-size:12px;letter-spacing:2px;color:#b9b4ff}
.n{font-size:26px;font-weight:800;margin:6px 0}.r{display:flex;justify-content:space-between;margin-top:10px;font-size:14px}</style>
<div class="t"><div class="a">ADMIT TWO</div><div class="n">The Lumineers</div><div>Ball Arena · Denver</div>
<div class="r"><span>Fri Oct 24 · 8:00 PM</span><span>Sec 112 · Row F</span></div></div>`;

for (const [name, html] of Object.entries(assets)) {
	const htmlPath = path.join(OUT, `${name}.html`);
	fs.writeFileSync(htmlPath, `<!doctype html><meta charset="utf-8">${html}`);
	execFileSync(CHROME, [
		'--headless=new',
		'--disable-gpu',
		'--hide-scrollbars',
		'--force-device-scale-factor=2',
		`--screenshot=${path.join(OUT, `${name}.png`)}`,
		'--window-size=390,560',
		`file://${htmlPath}`,
	], { stdio: 'ignore' });
	fs.unlinkSync(htmlPath);
	console.log('made', name);
}
