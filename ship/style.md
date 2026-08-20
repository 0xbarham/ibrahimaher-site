# How this site is written

Read this before writing a word of copy for ibrahimaher.com. It is not a
preference sheet. It describes the voice the site already has, taken from copy
that is already live and working, so anything added matches rather than
inventing a second register alongside the first.

The linter in `ship/lib/style.mjs` enforces the mechanical half. This file is
the half a linter cannot check.

---

## The one hard rule

**No em dashes. No en dashes.** Not in body copy, not in a title, not in alt
text, not in a meta description.

Use a comma when the clause is an aside. Use a full stop when it is a second
thought. Use brackets when it is genuinely parenthetical. If none of those fit,
the sentence is doing two jobs and wants to be two sentences.

The rule exists because the em dash has become the most reliable single tell
that a machine wrote something, and this site sells work done by a person.
Every other rule below is a preference. This one is not.

The linter blocks a publish on it, and never auto-fixes it, because choosing
between a comma, a full stop and brackets needs to know what the sentence meant.

---

## The voice, from the copy that already works

Two live examples, both from the projects section.

> Vendors do not usually email asking you to change their bank details.
> Fraudsters do, and they pick the end of a long day to do it.

> Iraqi businesses lose orders overnight, not to a competitor but to silence: a
> customer messages a shop at 11pm and nobody answers until morning.

Look at what those do:

- They open on a fact about the reader's world, not on the product.
- They name the specific circumstance. The end of a long day. 11pm.
- They have a point of view. Someone thought about this and is telling you.
- Neither says what the software "enables" or "empowers".

That is the target.

---

## Rules that need judgement

### Open at the fact

Start where the interesting thing is. No throat-clearing, no scene-setting, no
sentence that could sit at the top of any article on the subject.

Weak: "Automation has become increasingly important for businesses in Iraq."
Better: "A supplier emailed at 4pm on a Thursday asking to change their IBAN."

### Say who, and say when

A number, a date, a place, a name. Copy without specifics reads as a claim, and
a claim on a portfolio reads as a guess. If a build saved four hours a week,
write four hours a week. If it is an estimate, say it is an estimate.

### Vary the length of your sentences

The strongest tell after the em dash. Generated prose runs every sentence at
roughly the same length, and the rhythm is unmistakable once you hear it. Put a
five-word sentence next to a thirty-word one. Let a paragraph be a single line
when the line earns it.

The linter reports the standard deviation of sentence length and complains
below 4.5. That is a floor, not a target.

### Write in first person

It is a personal site. "I built", "I found", "it took me two tries". Copy with
no "I" in it reads like a brochure someone else wrote about you. The exception
is a project body describing what the system does, where the system is the
subject.

### Prefer the concrete verb

Not "leverages" but "uses". Not "facilitates" but "runs" or "sends" or "checks".
Not "streamlines the process" but "cuts the two approval emails to one".

### Do not explain the obvious back to the reader

Anyone reading a project page about n8n knows what a workflow is. Spending a
paragraph defining it is how a page loses the reader it already had.

### Admit the hard part

Every build had one thing that did not work the first time. Say what it was.
This is the most credible thing that can appear on a portfolio, because nobody
making it up would include it.

### Let a sentence end

Resist the pivot. "It is not just X, it is Y" wants to be "It is Y". "Not only
X but also Y" wants to be two sentences, or one.

---

## Words to stop reaching for

delve, leverage, utilize, facilitate, robust, seamless, streamline, holistic,
synergy, paradigm, tapestry, testament, myriad, plethora, embark, unlock,
elevate, supercharge, revolutionize, empower, transformative, game-changer,
cutting-edge, state-of-the-art, ever-evolving, deep dive, in the realm of,
at the end of the day, moving forward, needless to say, first and foremost,
in conclusion, in summary.

The linter warns on all of these. A warning is not a ban. If "robust" is the
precise word for the thing, keep it and pass `--force`. It usually is not.

## Shapes to stop reaching for

- "In today's fast-moving world..."
- "Whether you are a small business or an enterprise..."
- "That is where X comes in."
- "Here is the thing."
- "The result? A faster process."
- "Let us dive in."
- A rhetorical question as an opening line.
- Three adverbs in a row, joined by "and".

---

## Mechanics

- Headings in sentence case, not Title Case.
- No exclamation marks anywhere.
- No emoji in body copy.
- Three full stops, never the single ellipsis character.
- One space after a full stop.
- Straight quotes, unless the surrounding copy is already curly.
- British or American spelling, consistently within one piece. The site is
  mostly British.

---

## Per-field targets

| Field | Target |
|---|---|
| Project title | The plain name of the thing. Not a slogan, not a colon-subtitle. |
| Project body | Four paragraphs: the problem in the reader's terms, what it does mechanically, the hard part, the outcome with a number. |
| Post title | Under 60 characters, sentence case, a claim rather than a label. |
| Excerpt | One sentence, under 160 characters, not a copy of the first line. |
| `seo_description` | Under 155 characters, written for a person. A crawler reads what a person reads. |
| Alt text | What is in the frame, not the project name again. Someone who cannot see the image should be able to picture it. |

---

## Arabic

Arabic posts are written in Arabic, not translated from English. The register is
the spoken form, close to how the existing Arabic posts on the site read, rather
than formal Modern Standard. The em dash rule applies identically.

Do not machine-translate an English post and publish it. The three Arabic posts
already on the site were written directly, and the difference shows.

---

## Before publishing, read it out loud

If a sentence is hard to say, it is hard to read. If you would not say it to
someone across a table, do not put it on the site.
