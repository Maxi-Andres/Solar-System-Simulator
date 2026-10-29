import { createElement, type ReactNode } from 'react';

/**
 * Equations as MathML, the browser's own maths: Chromium, Firefox and Safari all lay it
 * out, it takes the text colour of the dark theme like any other text, and it costs no
 * library. React renders these tags in the MathML namespace once they are inside a
 * `<math>` element.
 *
 * Built with `createElement` rather than JSX because the React typings carry no MathML
 * elements, and because a formula reads better as nested calls than as nested tags:
 *
 *   math(row(sub(mi('r'), mi('s')), mo('='), frac(row(mn('2'), mi('G'), mi('M')), sup(mi('c'), mn('2')))))
 *
 * `t` shortens the flat runs: `t('M = E − e sin E')` is one token per space-separated
 * word (see `token`).
 */

type Node = ReactNode;

const el = (tag: string, ...children: Node[]) => createElement(tag, null, ...children);

export const mi = (name: string) => el('mi', name);
/** An identifier set upright: a word, a unit or a label rather than a variable. */
export const up = (name: string) => createElement('mi', { mathvariant: 'normal' }, name);
export const mn = (value: string) => el('mn', value);
export const mo = (op: string) => el('mo', op);
export const mtext = (text: string) => el('mtext', text);
export const row = (...children: Node[]) => el('mrow', ...children);
export const frac = (numerator: Node, denominator: Node) => el('mfrac', numerator, denominator);
export const sup = (base: Node, exponent: Node) => el('msup', base, exponent);
export const sub = (base: Node, index: Node) => el('msub', base, index);
export const subsup = (base: Node, index: Node, exponent: Node) => el('msubsup', base, index, exponent);
export const sqrt = (...children: Node[]) => el('msqrt', ...children);
/** A thin space, to separate the clauses of one line. */
export const gap = (width = '1em') => createElement('mspace', { width });
/** Parentheses that grow with what they hold. */
export const paren = (...children: Node[]) => row(mo('('), ...children, mo(')'));

/** A displayed equation. */
export function math(...children: Node[]): Node {
  return createElement('math', { display: 'block' }, ...children);
}

/** An equation inside a sentence. */
export function inline(...children: Node[]): Node {
  return createElement('math', null, ...children);
}

const NUMBER = /^[0-9][0-9.,]*[″′°]?$/;
const NAME = /^[\p{L}][\p{L}′']*$/u;

/** One token of `t`: a number, a name, `~unit` set upright, `base^exponent`, or an operator. */
function token(source: string): Node {
  if (source.length > 1 && source.startsWith('~')) {
    // A unit, a thin space off its number as print sets it.
    return row(createElement('mspace', { width: '0.17em' }), up(source.slice(1)));
  }
  const caret = source.indexOf('^');
  if (caret > 0 && caret < source.length - 1) {
    return sup(token(source.slice(0, caret)), token(source.slice(caret + 1)));
  }
  if (FUNCTIONS.has(source)) {
    return fn(source);
  }
  return NUMBER.test(source) ? mn(source) : NAME.test(source) ? mi(source) : mo(source);
}

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'ln', 'log', 'exp']);

/**
 * A function name, sin or cos, with the thin spaces either side that print gives it.
 * MathML Core sets no space between identifiers, so `e sin E` would otherwise read esinE.
 */
export function fn(name: string): Node {
  return row(
    createElement('mspace', { width: '0.17em' }),
    up(name),
    createElement('mspace', { width: '0.17em' }),
  );
}

/**
 * A flat run of tokens, space-separated: `t('r = a ( 1 − e cos E )')`. A number is <mn>, a
 * name <mi> (one letter italic, a word like cos upright), `~km` an upright unit, `s^3` a
 * power, anything else an operator.
 */
export function t(source: string): Node {
  return row(
    ...source
      .split(' ')
      .filter((part) => part !== '')
      .map(token),
  );
}

/** A letter with an accent over it: Ẇ (the default dot), x̄. */
export function mover(base: string, accent = '˙'): Node {
  return createElement('mover', { accent: 'true' }, mi(base), mo(accent));
}

/** Rows of cells, left-aligned: a piecewise relation, one piece a line. */
export function table(rows: readonly (readonly Node[])[]): Node {
  return createElement(
    'mtable',
    null,
    ...rows.map((cells) =>
      createElement(
        'mtr',
        null,
        ...cells.map((cell) =>
          createElement('mtd', { style: { textAlign: 'left', padding: '0.15em 0.8em 0.15em 0' } }, cell),
        ),
      ),
    ),
  );
}

/** Lines of one displayed equation, each centred under the last. */
export function lines(...rows: Node[]): Node {
  return createElement(
    'mtable',
    null,
    ...rows.map((line) => createElement('mtr', null, createElement('mtd', null, line))),
  );
}
