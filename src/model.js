// DOM に依存しない純粋な関数群(Node のテストで検証できる)。

export function newId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** 全角数字を半角にする。 */
export function toHalfWidthDigits(s) {
  return String(s ?? '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** ページ入力を正規化する。数字だけ取り出し、無ければ空文字。 */
export function parsePage(input) {
  const m = toHalfWidthDigits(input).match(/\d+/);
  return m ? m[0] : '';
}

function isbn13CheckDigit(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

/** ISBN を13桁にそろえる。10桁は変換し、検査桁が合わないものや桁違いは空文字を返す。 */
export function normalizeIsbn(raw) {
  const s = toHalfWidthDigits(raw).replace(/[^0-9Xx]/g, '').toUpperCase();
  if (s.length === 13 && /^\d{13}$/.test(s)) {
    return isbn13CheckDigit(s.slice(0, 12)) === s[12] ? s : '';
  }
  if (s.length === 10 && /^\d{9}[\dX]$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i);
    const check = (11 - (sum % 11)) % 11;
    if ((check === 10 ? 'X' : String(check)) !== s[9]) return '';
    const first12 = '978' + s.slice(0, 9);
    return first12 + isbn13CheckDigit(first12);
  }
  return '';
}

/** OCR 結果の末尾にある「[ページ: N]」を取り出す。 */
export function extractPageMarker(text) {
  const src = String(text ?? '');
  const m = src.match(/\n*\[ページ[:：]\s*([0-9０-９]+)\]\s*$/);
  if (!m) return { text: src.trim(), page: '' };
  return { text: src.slice(0, m.index).trim(), page: parsePage(m[1]) };
}

const oneLine = (s) => String(s ?? '').split(/\s+/).filter(Boolean).join(' ');

/** `p.12 「引用」→ 所感` の本体(先頭の "- " は含まない)。空なら空文字。 */
export function formatNoteBody(note) {
  const quote = oneLine(note.quote);
  const comment = oneLine(note.comment);
  const page = String(note.page ?? '').trim();
  const parts = [];
  if (page) parts.push(`p.${page}`);
  if (quote) parts.push(`「${quote}」` + (comment ? `→ ${comment}` : ''));
  else if (comment) parts.push(comment);
  return parts.join(' ');
}

/** 書き出し用 JSON(`books import-memo` が読む形式)。メモの無い本は含めない。 */
export function buildExport(books, notes, now = new Date()) {
  const out = [];
  for (const book of books) {
    const own = notes
      .filter((n) => n.bookId === book.id)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    if (own.length === 0) continue;
    out.push({
      isbn: book.isbn || '',
      title: book.title,
      authors: book.authors ? [book.authors] : [],
      notes: own.map((n) => ({
        id: n.id,
        page: n.page || '',
        quote: n.quote || '',
        comment: n.comment || '',
        created_at: n.createdAt,
        ocr: n.ocr || 'manual',
      })),
    });
  }
  return { version: 1, exported_at: now.toISOString(), books: out };
}

/** 読み物用の Markdown。 */
export function toMarkdown(exported) {
  const lines = [`# 読書メモ (${exported.exported_at.slice(0, 10)})`, ''];
  for (const book of exported.books) {
    lines.push(`## ${book.title}`);
    if (book.isbn) lines.push(`ISBN: ${book.isbn}`);
    lines.push('');
    for (const n of book.notes) {
      const body = formatNoteBody(n);
      if (body) lines.push(`- ${body}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
