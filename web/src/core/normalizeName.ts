/**
 * normalizeName on its own, importing nothing: the name search worker (nameSearch.worker.ts)
 * makes its indexes with it, and search.ts, which re-exports it, pulls in half the app.
 */

/**
 * A name made comparable: lower case, accents dropped, and anything that is not a letter
 * or a digit turned into a single space.
 *
 * So "Europa Clipper", "europa-clipper" and "EUROPA  clipper" are one name, "Hiʻiaka"
 * matches "hiiaka", and a provisional designation like "S/2004 S 12" matches "s 2004 s12"
 * as well as "2004 s 12".
 */
export function normalizeName(text: string): string {
  // Plain ASCII, as nearly every catalogue name is, has no accents to take apart and no letter
  // past z: the same result, without the Unicode passes that were most of an index's making.
  const ascii = asciiForm(text);
  if (ascii === CLEAN) {
    return text.toLowerCase();
  }
  if (ascii === ASCII) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  return text
    .normalize('NFD')
    // Combining marks, and modifier letters such as the ʻokina in Hiʻiaka, which Unicode
    // counts as a letter but nobody types.
    .replace(/[\p{M}\p{Lm}]/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Letters and digits with single spaces between, ASCII: lower case is all it needs. */
const CLEAN = 0;
/** ASCII with something else in it: a hyphen, a slash, two spaces. */
const ASCII = 1;
const UNICODE = 2;

function asciiForm(text: string): typeof CLEAN | typeof ASCII | typeof UNICODE {
  let form: typeof CLEAN | typeof ASCII = CLEAN;
  let previousSpace = true;
  for (let k = 0; k < text.length; k += 1) {
    const c = text.charCodeAt(k);
    if (c > 0x7f) {
      return UNICODE;
    }
    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57)) {
      previousSpace = false;
    } else if (c === 32 && !previousSpace) {
      previousSpace = true;
    } else {
      form = ASCII;
    }
  }
  return previousSpace && text.length > 0 ? ASCII : form;
}
