/**
 * The house-style checker.
 *
 * "Write it human, no em dashes" is a judgement call every time it is made by
 * hand, and judgement at 11pm on a Thursday is not reliable. This module turns
 * the parts that can be mechanical into something that fails loudly, so the
 * only judgement left is the part that genuinely needs a person.
 *
 * Two severities, and the split matters:
 *   error - blocks the publish. Only things that are wrong every time.
 *   warn  - printed, never blocks. Things that are usually wrong, so a human
 *           has to look. A warn that fires on good writing is a bug in the rule.
 *
 * Fenced code blocks, inline code, HTML tags and URLs are excluded from every
 * prose rule. An n8n expression or a shell flag is not prose.
 */

/** Blank out code, tags, URLs and link targets, keeping offsets stable so
 *  reported line and column numbers still point at the real text. */
export function proseOnly(text) {
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length))
    .replace(/<[^>\n]+>/g, (m) => ' '.repeat(m.length))
    .replace(/https?:\/\/\S+/g, (m) => ' '.repeat(m.length))
    .replace(/\]\([^)\n]*\)/g, (m) => ' '.repeat(m.length));
}

/**
 * Words that are not wrong in English but are overwhelmingly the fingerprint of
 * generated copy. Each is paired with what to reach for instead, because a
 * linter that only says "no" gets switched off.
 */
const TELL_WORDS = [
  ['delve', 'go into, look at'],
  ['leverage', 'use'],
  ['utilize', 'use'],
  ['utilise', 'use'],
  ['facilitate', 'help, let, run'],
  ['robust', 'say what it survives'],
  ['seamless', 'say what stopped breaking'],
  ['streamline', 'cut a step, name it'],
  ['holistic', 'drop it'],
  ['synergy', 'drop it'],
  ['paradigm', 'drop it'],
  ['tapestry', 'drop it'],
  ['testament', 'drop it'],
  ['myriad', 'many, or the number'],
  ['plethora', 'many, or the number'],
  ['embark', 'start'],
  ['unlock', 'name what you get'],
  ['elevate', 'name what improves'],
  ['supercharge', 'name what got faster'],
  ['revolutioni', 'name the change'],
  ['empower', 'name what they can now do'],
  ['transformative', 'name the transformation'],
];

/** Multi-word tells, matched as phrases. */
const TELL_PHRASES = [
  [/\bgame.?changer\b/i, 'say what changed'],
  [/\bcutting.?edge\b/i, 'name the version or the year'],
  [/\bstate.of.the.art\b/i, 'name the version or the year'],
  [/\bever.?evolving\b/i, 'drop it'],
  [/\bin the realm of\b/i, 'in'],
  [/\bdeep dive\b/i, 'drop it'],
  [/\bat the end of the day\b/i, 'drop it'],
  [/\bmoving forward\b/i, 'drop it'],
  [/\bit(?:'|’)?s worth noting\b/i, 'drop it and just note the thing'],
  [/\bneedless to say\b/i, 'then do not say it'],
  [/\bin conclusion\b/i, 'just end'],
  [/\bin summary\b/i, 'just end'],
  [/\bfirst and foremost\b/i, 'first'],
];

/**
 * Sentence and paragraph shapes that read as machine-made.
 *
 * Every one of these accepts both the contracted and the spelled-out form. That
 * is not thoroughness for its own sake: this site's own style guide writes them
 * spelled out, so a rule matching only `it's` would wave through exactly the
 * copy this project produces. The first regression run proved it, letting
 * "It is not just fast, it is transformative" pass clean.
 */
const IS = "(?:(?:'|’)s| is)";
const TELL_SHAPES = [
  [new RegExp(`\\bit${IS} not (?:just )?(?:about )?[^.!?\\n]{2,60}?,?\\s*it${IS}\\b`, 'i'),
    'The "it is not X, it is Y" pivot. Say Y once and move on.'],
  [/\bnot only\b[^.!?\n]{2,80}?\bbut also\b/i,
    '"Not only X but also Y". Two sentences, or just Y.'],
  [/\bwhether you(?:(?:'|’)re| are)\b[^.!?\n]{2,60}?\bor\b/i,
    '"Whether you are X or Y" addresses nobody. Pick the one reader.'],
  [/\bin today(?:'|’)?s\b[^.\n]{0,40}\b(?:world|landscape|market|climate|era)\b/i,
    'The "in today\'s fast-moving world" opener. Start at the fact.'],
  [new RegExp(`\\bthat${IS} where\\b[^.\\n]{0,50}\\bcomes? in\\b`, 'i'),
    '"That is where X comes in". Introduce X by doing something with it.'],
  [new RegExp(`\\bhere${IS} the thing\\b`, 'i'), '"Here is the thing". Say the thing.'],
  [/^\s*(?:the (?:result|problem|catch|answer|difference|upshot))\?\s*$/i,
    'One-word rhetorical question as a paragraph. Answer it as a sentence.'],
  [/\blet(?:(?:'|’)s| us) (?:dive|jump|get) (?:in|into|started)\b/i, 'Filler. Start.'],
  [/\bimagine (?:a world|if you)\b/i, 'Filler opener.'],
  [/\bthink of it (?:as|like)\b/i, 'Usually a metaphor covering for a missing fact.'],
  [/\bcan help you\b/i, 'Hedge. Say what it does.'],
  [/\b(?:is|are) designed to\b/i, 'Hedge. Say what it does.'],
  [/\baims to\b/i, 'Hedge. Say what it does.'],
];

function indicesOf(line, re) {
  const out = [];
  let m;
  while ((m = re.exec(line))) {
    out.push(m.index);
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

const RULES = [
  // ---------------------------------------------------------------- errors
  {
    id: 'em-dash',
    severity: 'error',
    // U+2014 em dash, U+2013 en dash, U+2015 horizontal bar, and the ASCII "--"
    // typed as a stand-in for one. The lookarounds spare "<!--", "-->" and the
    // "---" of a frontmatter fence.
    test: (line) => indicesOf(line, /[—–―]|(?<![-!<])--(?!-|>)/g),
    message: 'Em or en dash. Use a comma, a full stop, or brackets. This is the hard rule.',
  },
  {
    id: 'ellipsis-char',
    severity: 'error',
    test: (line) => indicesOf(line, /…/g),
    message: 'Ellipsis character. Three full stops, or better, finish the sentence.',
  },
  {
    id: 'exclamation',
    severity: 'error',
    // `!=` is code that slipped past the mask, and `![` opens a markdown image.
    // Neither is punctuation, and flagging the second one blocks the publish of
    // any post that contains a picture.
    test: (line) => indicesOf(line, /!(?![=[])/g),
    message: 'Exclamation mark. The work is the emphasis.',
  },
  {
    id: 'emoji',
    severity: 'error',
    test: (line) => indicesOf(line, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu),
    message: 'Emoji in body copy. Not the register of this site.',
  },
  {
    id: 'nbsp',
    severity: 'error',
    test: (line) => indicesOf(line, / /g),
    message: 'Non-breaking space, almost always pasted in by accident.',
  },

  // ----------------------------------------------------------------- warns
  {
    id: 'tell-word',
    severity: 'warn',
    test: (line) => {
      const hits = [];
      for (const [word, fix] of TELL_WORDS) {
        const re = new RegExp(`\\b${word}\\w*\\b`, 'gi');
        let m;
        while ((m = re.exec(line))) hits.push({ index: m.index, note: `"${m[0]}" -> ${fix}` });
      }
      for (const [re, fix] of TELL_PHRASES) {
        const m = re.exec(line);
        if (m) hits.push({ index: m.index, note: `"${m[0]}" -> ${fix}` });
      }
      return hits;
    },
    message: 'Generated-copy vocabulary.',
  },
  {
    id: 'tell-shape',
    severity: 'warn',
    test: (line) => {
      const hits = [];
      for (const [re, note] of TELL_SHAPES) {
        const m = re.exec(line);
        if (m) hits.push({ index: m.index, note });
      }
      return hits;
    },
    message: 'Generated-copy sentence shape.',
  },
  {
    id: 'rule-of-three',
    severity: 'warn',
    // "quickly, cleanly, and reliably" - the tricolon generated prose reaches
    // for by reflex. Real writing uses it too, which is why this only warns.
    test: (line) => indicesOf(line, /\b\w+ly\b,\s*\b\w+ly\b,?\s+and\s+\b\w+ly\b/gi),
    message: 'Triadic list of adverbs. Two items, or four, or make them concrete.',
  },
  /*
    The two whitespace rules read the RAW line, not the masked one.

    Masking blanks a code span or a URL out to spaces so prose rules cannot see
    inside it, which is right for prose and fatal here: `starting with
    `/idea` triggers it` masks to a run of spaces and reports a double
    space that does not exist. Every warning these two rules produced on their
    first real run was that false positive.
  */
  {
    id: 'double-space',
    severity: 'warn',
    raw: true,
    test: (line) => (/^\s*$/.test(line) ? [] : indicesOf(line, /(?<=\S)  +(?=\S)/g)),
    message: 'Double space mid-line.',
  },
  {
    id: 'trailing-space',
    severity: 'warn',
    raw: true,
    test: (line) => indicesOf(line, /[ \t]+$/g),
    message: 'Trailing whitespace.',
  },
  {
    id: 'title-case-heading',
    severity: 'warn',
    test: (line) => {
      const m = /^#{1,6}\s+(.*)$/.exec(line);
      if (!m) return [];
      const words = m[1].split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
      if (words.length < 4) return [];
      const capped = words.filter((w) => /^[A-Z]/.test(w)).length;
      return capped / words.length > 0.75 ? [{ index: 0, note: `"${m[1]}"` }] : [];
    },
    message: 'Title Case heading. This site writes headings in sentence case.',
  },
];

/**
 * Whole-text observations a per-line rule cannot see.
 *
 * All warnings by design. Every one is a signal, not a fault: a 40-word
 * sentence can be the best sentence in the piece.
 */
function textLevel(prose) {
  const notes = [];
  const sentences = prose
    .replace(/\n+/g, ' ')
    .split(/(?<=[.?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length > 2);

  if (sentences.length >= 5) {
    const lens = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);

    if (mean > 26) {
      notes.push(`Average sentence is ${mean.toFixed(1)} words. Long enough that a reader stops hearing it.`);
    }
    // Uniform length is the strongest single tell of generated prose. People
    // write a nine-word sentence next to a thirty-word one without noticing.
    if (sd < 4.5) {
      notes.push(
        `Sentence lengths barely vary (sd ${sd.toFixed(1)}, mean ${mean.toFixed(1)}). ` +
        'Break one in half, let another run long.'
      );
    }
    if (Math.max(...lens) < 20) {
      notes.push('No sentence runs past 20 words. The rhythm reads clipped and machine-set.');
    }
  }

  const words = prose.split(/\s+/).filter(Boolean).length;
  if (words > 120) {
    if (!/\b(?:I|my|me|we|our)\b/i.test(prose)) {
      notes.push('No first person anywhere. On a personal site that reads like a brochure someone else wrote.');
    }
    const digits = (prose.match(/\b\d[\d.,]*/g) || []).length;
    if (digits < 2) {
      notes.push('Almost no concrete numbers. A build with no numbers in it reads like a claim.');
    }
  }

  return notes;
}

/**
 * Lint a block of copy.
 *
 * @param {string} text  markdown or HTML body copy
 * @param {{label?: string}} opts
 * @returns {{errors: object[], warnings: object[], notes: string[], ok: boolean}}
 */
export function lint(text, { label = 'copy' } = {}) {
  const masked = proseOnly(String(text ?? ''));
  const lines = masked.split('\n');
  const raw = String(text ?? '').split('\n');
  const errors = [];
  const warnings = [];

  lines.forEach((line, i) => {
    for (const rule of RULES) {
      // A `raw` rule is about the characters as typed, so masking would hide or
      // invent exactly what it is looking for. See the whitespace rules above.
      for (const hit of rule.test(rule.raw ? (raw[i] ?? '') : line) || []) {
        const index = typeof hit === 'number' ? hit : hit.index;
        const note = typeof hit === 'number' ? '' : hit.note;
        const entry = {
          label,
          rule: rule.id,
          line: i + 1,
          column: index + 1,
          message: note ? `${rule.message} ${note}` : rule.message,
          excerpt: raw[i]?.slice(Math.max(0, index - 30), index + 50).trim(),
        };
        (rule.severity === 'error' ? errors : warnings).push(entry);
      }
    }
  });

  return { errors, warnings, notes: textLevel(masked), ok: errors.length === 0 };
}

/**
 * Fix only what is unambiguous.
 *
 * An em dash is deliberately NOT auto-fixed. Replacing it needs to know whether
 * the clause wanted a comma, a full stop or brackets, and guessing produces
 * copy that passes the linter and reads worse, which is the exact failure this
 * module exists to prevent.
 */
export function autofix(text) {
  return String(text)
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/(?<=\S)  +(?=\S)/g, ' ');
}

export function formatReport({ errors, warnings, notes }, { showWarnings = true } = {}) {
  const out = [];
  for (const e of errors) {
    out.push(`  ERROR ${e.label}:${e.line}:${e.column}  [${e.rule}] ${e.message}`);
    if (e.excerpt) out.push(`        ...${e.excerpt}...`);
  }
  if (showWarnings) {
    for (const w of warnings) {
      out.push(`  warn  ${w.label}:${w.line}:${w.column}  [${w.rule}] ${w.message}`);
    }
    for (const n of notes) out.push(`  note  ${n}`);
  }
  return out.join('\n');
}
