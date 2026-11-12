// Spoken maths -> a small tree -> plain text / MathML / keystrokes. Pure parsing, no ML.
// RIGHT marks "press right arrow" (leave an exponent / fraction / root in the pad).
const RIGHT = '→';

const WORDS = {
  'square root of': 'sqrt', 'square root': 'sqrt', 'root of': 'sqrt',
  'open parenthesis': '(', 'open paren': '(', 'left parenthesis': '(', 'left paren': '(', 'open bracket': '(', 'open': '(',
  'close parenthesis': ')', 'closed parenthesis': ')', 'close paren': ')', 'closed paren': ')',
  'right parenthesis': ')', 'right paren': ')', 'close bracket': ')', 'close': ')', 'closed': ')',
  'to the power of': '^', 'to the power': '^', 'raised to the': '^', 'raised to': '^', 'to the': '^',
  'squared': '²', 'cubed': '³',
  'multiplied by': '*', 'times': '*', 'divided by': '/', 'over': '/',
  'plus': '+', 'minus': '-', 'negative': '-',
  'is equal to': '=', 'equal to': '=', 'equals': '=', 'point': '.', 'comma': ',',
  'natural log': 'ln', 'lawn': 'ln',
  'arc sine': 'arcsin', 'arcsine': 'arcsin', 'inverse sine': 'arcsin',
  'arc cosine': 'arccos', 'arccosine': 'arccos', 'inverse cosine': 'arccos',
  'arc tangent': 'arctan', 'arctangent': 'arctan', 'inverse tangent': 'arctan',
  'sine': 'sin', 'sign': 'sin', 'cosine': 'cos', 'cosign': 'cos', 'tangent': 'tan',
  'secant': 'sec', 'cosecant': 'csc', 'cotangent': 'cot',
  'pie': 'pi', 'fi': 'phi', 'fie': 'phi', 'fee': 'phi', 'data': 'theta', 'why': 'y', 'ex': 'x', 'see': 'c',
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
  'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
  'second': '2', 'third': '3', 'fourth': '4', 'fifth': '5', 'sixth': '6',
  'seventh': '7', 'eighth': '8', 'ninth': '9', 'tenth': '10',
  'of': '', 'the': '', 'power': ''
};
const SYMBOLS = { '√': ' sqrt ', '×': '*', '÷': '/', 'π': ' pi ', '−': '-', 'θ': ' theta ' };
const FUNCS = new Set(['sqrt', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh', 'ln', 'log']);

const WORD_RE = new RegExp('\\b(' + Object.keys(WORDS).sort((a, b) => b.length - a.length).join('|') + ')\\b', 'g');

function tokenize(speech) {
  let s = speech.toLowerCase();
  s = s.replace(/[√×÷π−θ]/g, c => SYMBOLS[c]);
  s = s.replace(WORD_RE, w => ' ' + WORDS[w] + ' ');
  s = s.replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');
  return s.match(/\d+(\.\d+)?|\.\d+|[a-z]+|[-+*\/^()=,²³]/g) || [];
}


const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ',
  lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ',
  omega: 'ω', infinity: '∞' };

// Nodes: {t:'atom',v} {t:'op',v} {t:'group',items} {t:'func',name,arg,pow} {t:'sup',base,exp} {t:'frac',num,den}
function parse(speech) {
  const toks = tokenize(speech);
  let i = 0;
  const isAtom = t => t !== undefined && /^[a-z0-9.]/.test(t) && !FUNCS.has(t);
  const atom = v => ({ t: 'atom', v });

  function seq(untilClose) {
    const items = [];
    while (i < toks.length) {
      const t = toks[i];
      if (t === ')') { i++; if (untilClose) break; continue; }
      if (t === '(') { i++; items.push({ t: 'group', items: seq(true) }); }
      else if (FUNCS.has(t)) items.push(func());
      else if (t === '²' || t === '³') { i++; items.push({ t: 'sup', base: popBase(items), exp: [atom(t === '²' ? '2' : '3')] }); }
      else if (t === '^') { i++; items.push({ t: 'sup', base: popBase(items), exp: operand() }); }
      else if (t === '/') { i++; items.push({ t: 'frac', num: popBase(items), den: operand() }); }
      else { i++; items.push(isAtom(t) ? atom(t) : { t: 'op', v: t }); }
    }
    return items;
  }
  function popBase(items) {
    const last = items[items.length - 1];
    return last && last.t !== 'op' ? items.pop() : null;
  }
  function operand() {          // what a function, exponent or denominator applies to
    const out = [];
    if (toks[i] === '-') { out.push({ t: 'op', v: '-' }); i++; }
    if (toks[i] === '(') { i++; out.push({ t: 'group', items: seq(true) }); return out; }
    if (FUNCS.has(toks[i])) { out.push(func()); return out; }
    while (isAtom(toks[i])) out.push(atom(toks[i++]));
    return out;
  }
  function func() {
    const name = toks[i++];
    let pow = null;             // "cosine squared x"
    if (toks[i] === '²' || toks[i] === '³') pow = toks[i++] === '²' ? '2' : '3';
    let arg = operand();
    if (arg.length === 1 && arg[0].t === 'group') arg = arg[0].items;
    return { t: 'func', name, arg, pow };
  }
  return seq(false);
}

const unwrap = items => (items.length === 1 && items[0].t === 'group' ? items[0].items : items);
const simple = items => items.length === 1 && items[0].t === 'atom';

// Plain calculator syntax, e.g. sqrt(x+1)/(2pi). R is appended after structures (used for keystrokes).
function toText(items, R, greek) {
  const paren = it => (simple(it) ? toText(it, R, greek) : '(' + toText(unwrap(it), R, greek) + ')');
  return items.map(n => {
    switch (n.t) {
      case 'atom': return greek && GREEK[n.v] ? GREEK[n.v] : n.v;
      case 'op': return n.v;
      case 'group': return '(' + toText(n.items, R, greek) + ')';
      case 'func': return n.name + (n.pow ? '^' + n.pow + R : '') + '(' + toText(n.arg, R, greek) + ')' + (n.name === 'sqrt' ? R : '');
      case 'sup': return (n.base ? toText([n.base], R, greek) : '') + '^' + paren(n.exp) + R;
      case 'frac': return (n.num ? toText([n.num], R, greek) : '') + '/' + paren(n.den) + R;
    }
  }).join('');
}

function toMathML(items) {
  const row = it => { const s = toMathML(unwrap(it)); return unwrap(it).length === 1 ? s : '<mrow>' + s + '</mrow>'; };
  const fenced = it => '<mfenced><mrow>' + toMathML(it) + '</mrow></mfenced>';
  return items.map(n => {
    switch (n.t) {
      case 'atom':
        if (/^[\d.]/.test(n.v)) return '<mn>' + n.v + '</mn>';
        if (n.v === 'infinity') return '<mo>' + GREEK.infinity + '</mo>';
        if (GREEK[n.v]) return '<mi>' + GREEK[n.v] + '</mi>';
        return n.v.split('').map(c => '<mi>' + c + '</mi>').join('');
      case 'op': return '<mo>' + n.v + '</mo>';
      case 'group': return fenced(n.items);
      case 'func':
        if (n.name === 'sqrt') return '<msqrt>' + toMathML(n.arg) + '</msqrt>';
        return (n.pow ? '<msup><mi>' + n.name + '</mi><mn>' + n.pow + '</mn></msup>' : '<mi>' + n.name + '</mi>') + fenced(n.arg);
      case 'sup': return '<msup>' + (n.base ? row([n.base]) : '<mrow/>') + row(n.exp) + '</msup>';
      case 'frac': return '<mfrac>' + (n.num ? row([n.num]) : '<mrow/>') + row(n.den) + '</mfrac>';
    }
  }).join('');
}

function speechToWebAssign(speech) { return toText(parse(speech), '', false); }
function speechToKeys(speech) { return toText(parse(speech), RIGHT, true); }
function speechToMathML(speech) { return toMathML(parse(speech)); }

if (typeof module !== 'undefined') module.exports = { speechToWebAssign, speechToKeys, speechToMathML, RIGHT };
