#!/usr/bin/env node
/**
 * Keeps only CSS rules whose selectors reference classes/ids found in project HTML/TS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, 'src');

const EXTRA_TOKENS = new Set([
  'open',
  'active',
  'show',
  'hide',
  'even',
  'odd',
  'loss',
  'win',
  'lose',
  'playing',
  'clickAnimation',
  'before-active',
  'after-active',
  'disabledNextPrevButton',
  'gIPpIY',
  'iYgYIR',
  'spine-canvas',
  'sc-jObViz',
]);

const PREFIX_KEEP = [
  'ms-',
  'vim--',
  'bet-',
  'intro',
  'guide-',
  'empty-',
  'popup',
  'Slider',
  'step',
  'advance',
  'submit',
  'amount',
  'min',
  'max',
  'simple',
  'nonAdvance',
  'game-limits',
  'bet-limits',
  'pagination',
  'nextPrev',
  'pageNumber',
  'prevNext',
  'history-',
  'detail-',
  'coeff-',
  'row-',
  'arrow',
  'show-detail',
  'win-bet',
  'bet-box',
  'win-box',
  'bet-detail',
  'bet-history',
  'wrapper-items',
  'title-wrapper',
  'item-wrap',
  'spine-host',
  'textfit-',
  'pressableButton',
  'animation-wrapper',
  'fade-',
  'menu-root',
  'anim-panel',
  'anim-btn',
  'gEpkbQ',
  'burger',
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(html|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function collectTokens() {
  const tokens = new Set(EXTRA_TOKENS);
  const classAttr = /\bclass(?:Name)?="([^"]+)"/g;
  const classBind = /\[class\.([a-zA-Z0-9_-]+)\]/g;
  const staticClass = /\bclass:\s*'([^']+)'/g;

  for (const file of walk(srcRoot)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const re of [classAttr, classBind, staticClass]) {
      for (const match of content.matchAll(re)) {
        const raw = match[1];
        raw.split(/\s+/).filter(Boolean).forEach((t) => tokens.add(t));
      }
    }
  }
  return tokens;
}

function tokenReferenced(selector, tokens) {
  if (/:host-context|:host\b/.test(selector)) return true;
  for (const token of tokens) {
    if (
      selector.includes(`.${token}`) ||
      selector.includes(`#${token}`) ||
      selector.includes(`:${token}`) ||
      selector.includes(`[${token}`)
    ) {
      return true;
    }
  }
  for (const prefix of PREFIX_KEEP) {
    if (selector.includes(prefix)) return true;
  }
  return false;
}

function splitTopLevelBlocks(css) {
  const blocks = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        blocks.push(css.slice(start, i + 1).trim());
        start = i + 1;
      }
    }
  }
  const tail = css.slice(start).trim();
  if (tail) blocks.push(tail);
  return blocks.filter(Boolean);
}

function purgeCss(css, tokens) {
  const kept = [];
  const keyframes = new Map();

  for (const block of splitTopLevelBlocks(css)) {
    const trimmed = block.trim();
    if (trimmed.startsWith('@keyframes')) {
      const name = trimmed.match(/@keyframes\s+([^\s{]+)/)?.[1];
      if (name) keyframes.set(name, trimmed);
      continue;
    }

    if (/^@media/.test(trimmed) || /^@supports/.test(trimmed)) {
      const open = trimmed.indexOf('{');
      const header = trimmed.slice(0, open).trim();
      const inner = trimmed.slice(open + 1, -1);
      const innerKept = purgeCss(inner, tokens).css;
      if (innerKept.trim()) kept.push(`${header}{${innerKept}}`);
      continue;
    }

    const open = trimmed.indexOf('{');
    if (open === -1) {
      kept.push(trimmed);
      continue;
    }
    const selector = trimmed.slice(0, open).trim();
    const body = trimmed.slice(open);
    const parts = selector.split(',').map((s) => s.trim());
    if (parts.some((part) => tokenReferenced(part, tokens))) {
      kept.push(`${selector}${body}`);
    }
  }

  const usedKeyframes = new Set();
  const joined = kept.join('\n\n');
  for (const name of keyframes.keys()) {
    if (joined.includes(name)) usedKeyframes.add(name);
  }

  const finalParts = [];
  for (const name of usedKeyframes) finalParts.push(keyframes.get(name));
  finalParts.push(...kept);
  return { css: `${finalParts.join('\n\n')}\n`, usedKeyframes: [...usedKeyframes] };
}

const targets = [
  'src/app/components/game-wrapper/game-wrapper.css',
  'src/app/components/modals/bet-history-modal/bet-history-modal.css',
  'src/app/components/modals/guideness-modal/guideness-modal.css',
  'src/app/components/modals/bet-amount/bet-amount.css',
];

const tokens = collectTokens();
console.log(`Collected ${tokens.size} class/id tokens from source`);

for (const rel of targets) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const { css, usedKeyframes } = purgeCss(before, tokens);
  fs.writeFileSync(file, css);
  console.log(
    `${rel}: ${before.length} -> ${css.length} bytes (${usedKeyframes.length} keyframes kept)`,
  );
}
