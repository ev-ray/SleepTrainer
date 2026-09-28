// All of the app's advice lives here so it's easy to review and edit in one
// place. Keep it calm, concrete, and honest about what the evidence does and
// doesn't say.

// ─── Between-sleep checklists ────────────────────────────────────────────────
// Eat → play → sleep keeps feeding separate from falling asleep, so he doesn't
// learn to need a feed to drift off — which is the whole point of training.
// `at: 'winddown'` items are shown with the wind-down time.

export const CHECKLISTS = {
  morning: [
    { key: 'light', text: 'Curtains open, lights on', hint: 'Bright light and normal noise tell his body clock it’s day.' },
    { key: 'feed', text: 'Full feed', hint: 'Keep him awake and engaged through it.' },
    { key: 'diaper', text: 'Diaper & dressed' },
    { key: 'play', text: 'Play & tummy time' },
    { key: 'winddown', text: 'Wind-down', hint: 'Dim room, sleep sack, white noise on, same short song.', at: 'winddown' },
    { key: 'down', text: 'Down awake, say your phrase, leave' },
  ],
  nap: [
    { key: 'diaper', text: 'Diaper change' },
    { key: 'feed', text: 'Full feed', hint: 'Awake and alert — not a sleepy feed.' },
    { key: 'play', text: 'Play', hint: 'Tummy time, floor time, talking, a walk outside in daylight.' },
    { key: 'cues', text: 'Watch for sleepy cues', hint: 'Staring off, looking away, red eyebrows, yawns, fussing.' },
    { key: 'winddown', text: 'Wind-down', hint: 'Dim room, sleep sack, white noise on, same short song.', at: 'winddown' },
    { key: 'down', text: 'Down awake, say your phrase, leave' },
  ],
  bedtime: [
    { key: 'diaper', text: 'Diaper change' },
    { key: 'feed', text: 'Feed' },
    { key: 'play', text: 'Play — calmer as evening goes on' },
    { key: 'bath', text: 'Bath (optional)', hint: 'Warm, short, same order every night.', at: 'routine' },
    { key: 'pjs', text: 'Diaper, pajamas, sleep sack' },
    { key: 'feed2', text: 'Last feed with the lights on', hint: 'Keep him awake. If he dozes, gently rouse him.' },
    { key: 'book', text: 'Book & song, same every night' },
    { key: 'down', text: 'Down awake, say goodnight phrase, leave' },
  ],
}

// ─── CIO extinction method ───────────────────────────────────────────────────
export const PLAN = [
  {
    title: 'Same routine, every sleep',
    body: 'Short wind-down before naps, 20–30 minute routine at bedtime, in the same order. Consistent bedtime routines alone improve infant sleep within about two weeks (Mindell 2009).',
  },
  {
    title: 'Down awake, then leave',
    body: 'Drowsy is fine; asleep is not. Say the same phrase (“I love you, time to sleep”), walk out, close the door. The goal is for him to practice the last step — falling asleep — himself.',
  },
  {
    title: 'Don’t go back in until it’s time',
    body: 'Extinction means no check-ins: going in briefly and leaving usually makes crying longer, not shorter. The exceptions are planned feeds and anything on the “go in if” list.',
  },
  {
    title: 'Planned night feeds are part of the plan',
    body: 'At his age, 1–2 night feeds are normal. Decide with your pediatrician how long he should go between feeds, set it in Settings, and the app will tell you on each wake whether it’s a feed. Feed calmly in the dark, burp, and put him back down awake.',
  },
  {
    title: 'Morning starts at a fixed time',
    body: 'Anything before your morning time counts as night. After that, get him up with lights, voices and a feed so the day clearly starts.',
  },
  {
    title: 'Naps: up to an hour to try',
    body: 'If he hasn’t fallen asleep after about an hour, the attempt is over — get him up, keep going with the day, and try again a little earlier next time.',
  },
  {
    title: 'Everyone does it the same way',
    body: 'Grandma too. Mixed responses teach him that crying sometimes works, which is exactly what makes crying last longer.',
  },
]

// ─── Playbook: when things don't go to plan ──────────────────────────────────
export const PLAYBOOK = [
  {
    id: 'noSleep',
    title: 'He didn’t fall asleep for a nap',
    steps: [
      'After about an hour in the crib, end the attempt. Get him up calmly — it isn’t a reward, it’s just the plan.',
      'Diaper, feed if due, play as normal.',
      'He’s now short on sleep, so the next wake window is pulled in ~20 minutes. The countdown already accounts for it.',
      'If it was the last nap of the day, go for an early bedtime instead of another nap.',
    ],
    why: 'Nap training usually lags night training by days to weeks — day sleep consolidates later than night sleep. A failed nap doesn’t undo progress.',
  },
  {
    id: 'short',
    title: 'He woke early from a nap',
    steps: [
      'Tap “He woke up” — the nap stays open and the app tells you whether to wait.',
      'Under 45 minutes asleep: leave him up to 20 minutes to resettle, whether he’s chatting or crying. If he’s already resettled once this nap, give it 10.',
      '45–75 minutes: a 10-minute wait is optional. Over 75 minutes, or late in the day: get him up.',
      'If he falls back asleep, tap “Back asleep.” If the wait runs out, tap “Nap’s over.” A short nap shortens the next wake window by ~15 minutes automatically.',
    ],
    why: 'One-sleep-cycle naps (30–45 minutes) are very common until around 5–6 months. They lengthen on their own as he matures.',
  },
  {
    id: 'long',
    title: 'Nap is running long',
    steps: [
      'Cap single naps at about 2 hours — wake him gently.',
      'Too much day sleep steals from night sleep and pushes feeds overnight.',
      'Late-afternoon catnaps: aim to have him awake a full wake window before bedtime.',
    ],
  },
  {
    id: 'nightWake',
    title: 'He’s awake in the night',
    steps: [
      'Check the wake card: if it’s been long enough since his last feed (per your plan), this is a feed.',
      'Feed: lights low, no talking or play, burp, diaper only if needed, back down awake, leave.',
      'Not a feed: stay out. Crying at a night wake shortens fastest when the response is the same every time.',
      'Tap “Back asleep” when it’s quiet. If it was a feed, pick “Fed, back asleep” so the next wake knows when he last ate. You don’t need to be exact; you can fix times later.',
    ],
  },
  {
    id: 'early',
    title: 'Awake before morning time',
    steps: [
      'Treat it exactly like a night wake until your morning time.',
      'Near morning, the wake card works out when to start the day from when he fell asleep, time awake overnight and how much he napped yesterday. Wait until the time it gives.',
      'If he’s still awake then, get him up with lights on and a bright, cheerful start. Log “Up for the day.”',
      'Early waking often means bedtime is too late or the last wake window is too long — try moving bedtime 15 minutes earlier for a few days.',
    ],
  },
  {
    id: 'long-cry',
    title: 'Bedtime crying is going on a long time',
    steps: [
      'Nights 1–3 are usually the hardest. Long crying on night one is expected, not a sign it’s failing.',
      'An “extinction burst” — crying getting worse for a night or two after it had improved — is normal and usually means you’re close.',
      'Run through the “go in if” list. If nothing applies, open Hold steady, step away from the monitor, tag out if you can.',
    ],
  },
  {
    id: 'sick',
    title: 'Sick, teething, or vaccine day',
    steps: [
      'Comfort him. Being sick is a real reason to go in; call your pediatrician for fever or anything worrying.',
      'Keep the routine and put him down awake if you can.',
      'Once he’s well, go straight back to the plan. It usually takes a night or two to get back on track.',
    ],
  },
  {
    id: 'vomit',
    title: 'Threw up, blowout, or something’s off',
    steps: [
      'Go in. Clean up with lights low and minimal talking, then put him back down awake and leave.',
      'That’s not “giving in” — handling real needs calmly and briefly is part of the plan.',
    ],
  },
  {
    id: 'away',
    title: 'Car naps, outings, or a different caregiver',
    steps: [
      'An occasional nap on the go is fine — just keep the next wake window on schedule.',
      'Protect bedtime and nights most. If only one sleep a day can be perfect, make it bedtime.',
      'Anyone putting him down follows the same routine and the same “don’t go back in” rule.',
    ],
  },
]

// ─── Go in if… ───────────────────────────────────────────────────────────────
export const GO_IN_IF = [
  'His cry sounds different — high-pitched, panicked, or like he’s in pain.',
  'He feels hot, seems sick, or has vomited.',
  'Something is caught, like an arm or leg in the slats.',
  'It’s a planned feed.',
  'Your gut says something’s wrong. A quick, calm, lights-low check is always okay.',
]

// ─── Research ────────────────────────────────────────────────────────────────
export const RESEARCH = [
  {
    id: 'price',
    title: 'No harm five years later',
    source: 'Price et al., Pediatrics 2012',
    url: 'https://doi.org/10.1542/peds.2011-3467',
    finding:
      'Followed 225 children whose parents did (or didn’t) use behavioral sleep techniques around 8 months. At age 6: no differences in emotional or behavioral problems, stress hormones, sleep, or closeness with parents.',
    takeaway: 'Letting him learn to sleep doesn’t damage your bond.',
  },
  {
    id: 'gradisar',
    title: 'Faster sleep, fewer wakes, no extra stress',
    source: 'Gradisar et al., Pediatrics 2016',
    url: 'https://doi.org/10.1542/peds.2015-1486',
    finding:
      'Randomized trial in 6–16-month-olds. Babies in the graduated-extinction group fell asleep faster and woke less. Their stress hormone (cortisol) was no higher than controls, and a year later there were no differences in attachment or behavior.',
    takeaway: 'The crying is hard to hear, but the measured stress isn’t there.',
  },
  {
    id: 'mindell',
    title: 'The most-studied approach',
    source: 'Mindell et al., Sleep 2006 (AASM review)',
    url: 'https://doi.org/10.1093/sleep/29.10.1263',
    finding:
      'Reviewed 52 studies of behavioral sleep treatments; 94% found real improvement. Unmodified extinction was one of the best-supported methods, and no study found harmful side effects.',
    takeaway: 'You picked the approach with the deepest evidence base.',
  },
  {
    id: 'parents',
    title: 'Better for parents, too',
    source: 'Hiscock et al., BMJ 2002 & Arch Dis Child 2007',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Hiscock+infant+sleep+maternal+depression+randomized',
    finding:
      'In randomized trials, mothers whose babies received a behavioral sleep intervention reported fewer infant sleep problems and lower depression symptoms than controls.',
    takeaway: 'Rested parents are part of the goal, not a selfish extra.',
  },
  {
    id: 'routine',
    title: 'The routine does real work',
    source: 'Mindell et al., Sleep 2009',
    url: 'https://doi.org/10.1093/sleep/32.5.599',
    finding:
      'A consistent 3-step bedtime routine alone reduced time to fall asleep and night wakings in infants within two weeks.',
    takeaway: 'Doing the same routine every night is doing something.',
  },
  {
    id: 'burst',
    title: 'Why consistency matters so much',
    source: 'Williams, J Abnorm Soc Psychol 1959',
    url: 'https://doi.org/10.1037/h0046688',
    finding:
      'The classic extinction case: a toddler’s bedtime crying fell from 45 minutes to zero over about ten nights. Then one night a relative went back in — the crying came right back, and it took another week to fade.',
    takeaway: 'Sometimes-going-in teaches him crying sometimes works. Being consistent is the kindest, fastest path.',
  },
  {
    id: 'cortisol',
    title: 'What about the stress study?',
    source: 'Middlemiss et al., Early Hum Dev 2012',
    url: 'https://doi.org/10.1016/j.earlhumdev.2011.08.010',
    finding:
      'A small study (25 babies, no control group) reported infant cortisol stayed elevated after crying stopped. It’s often cited online, but without a comparison group it can’t say whether that level was unusual — and the randomized trial above (Gradisar 2016), which had one, found no cortisol difference.',
    takeaway: 'It’s worth knowing about — and the stronger evidence is reassuring.',
  },
  {
    id: 'sleepneeds',
    title: 'How much sleep he needs',
    source: 'Paruthi et al., J Clin Sleep Med 2016 (AASM)',
    url: 'https://doi.org/10.5664/jcsm.5866',
    finding:
      'Babies 4–12 months need 12–16 hours of sleep per 24 hours, naps included.',
    takeaway: 'The targets in this app come from this range.',
  },
]

// ─── Hold steady ─────────────────────────────────────────────────────────────
export const REMINDERS = [
  'He’s safe, he’s fed, and he’s learning. Crying is how he protests a change — not a sign of harm.',
  'You’re not leaving him. You’re giving him the chance to practice something he can only learn by doing.',
  'Every consistent night makes the next one shorter.',
  'Going in now would teach him that crying longer works. Staying out is the kind choice tonight.',
  'You can hate this part and still be doing the right thing.',
  'Tired parents who stick with it usually see a big change within a week.',
]

export const COPING = [
  'Turn the monitor volume down (keep the video) and watch the timer instead of listening.',
  'Step outside, take a shower, or put on headphones for ten minutes.',
  'Tag out — whoever is less rattled takes the next stretch.',
  'Set a check-in time for yourselves (not him): “we’ll look at the monitor at 20 minutes.”',
  'Breathe with the circle for a minute.',
]

export function whatsNormal(nightNo) {
  if (!nightNo) return null
  if (nightNo <= 3)
    return `Night ${nightNo}. The first three nights are the hardest — long crying now is expected and doesn’t mean it isn’t working.`
  if (nightNo <= 7)
    return `Night ${nightNo}. Most families see clear progress this week. A sudden bad night (an “extinction burst”) is common right before things click.`
  return `Night ${nightNo}. You’re past the steepest part. Wobbles happen — teething, regressions, a missed nap — and consistency brings it back fast.`
}
