import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildExport,
  extractPageMarker,
  formatNoteBody,
  normalizeIsbn,
  parsePage,
  toMarkdown,
} from '../src/model.js';

test('normalizeIsbn: 13桁・ハイフン・全角を受け付け、検査桁を確かめる', () => {
  assert.equal(normalizeIsbn('978-4-00-432122-4'), '9784004321224');
  assert.equal(normalizeIsbn('９７８４００４３２１２２４'), '9784004321224');
  assert.equal(normalizeIsbn('9784004321225'), ''); // 検査桁の誤り
  assert.equal(normalizeIsbn('123'), '');
});

test('normalizeIsbn: 10桁は13桁へ変換する', () => {
  assert.equal(normalizeIsbn('4004321220'), '9784004321224');
  assert.equal(normalizeIsbn('4-8025-1355-0'), '9784802513555');
  assert.equal(normalizeIsbn('4004321221'), ''); // 検査桁の誤り
});

test('parsePage: 数字だけを取り出す', () => {
  assert.equal(parsePage('p.123'), '123');
  assert.equal(parsePage('１２ページ'), '12');
  assert.equal(parsePage('なし'), '');
});

test('extractPageMarker: 末尾のページ表記を分離する', () => {
  assert.deepEqual(extractPageMarker('本文です。\n\n[ページ: 57]'), { text: '本文です。', page: '57' });
  assert.deepEqual(extractPageMarker('本文\n[ページ：１２]\n'), { text: '本文', page: '12' });
  assert.deepEqual(extractPageMarker('マーカーなし'), { text: 'マーカーなし', page: '' });
});

test('formatNoteBody: Python 側(memo_import.format_note)と同じ形式', () => {
  assert.equal(formatNoteBody({ page: '12', quote: '引用\n文', comment: '所感' }), 'p.12 「引用 文」→ 所感');
  assert.equal(formatNoteBody({ quote: 'だけ' }), '「だけ」');
  assert.equal(formatNoteBody({ page: '3', comment: 'メモのみ' }), 'p.3 メモのみ');
  assert.equal(formatNoteBody({}), '');
});

test('buildExport / toMarkdown: メモのある本だけを、作成順に出す', () => {
  const books = [
    { id: 'b1', title: 'ヒトとAI', isbn: '9784004321224', authors: '岡野原 大輔' },
    { id: 'b2', title: '空の本', isbn: '', authors: '' },
  ];
  const notes = [
    { id: 'n2', bookId: 'b1', page: '20', quote: '二つ目', comment: '', createdAt: '2026-10-02T00:00:00Z', ocr: 'claude' },
    { id: 'n1', bookId: 'b1', page: '5', quote: '一つ目', comment: '感想', createdAt: '2026-10-01T00:00:00Z' },
  ];
  const data = buildExport(books, notes, new Date('2026-10-12T00:00:00Z'));
  assert.equal(data.version, 1);
  assert.equal(data.books.length, 1);
  assert.deepEqual(data.books[0].notes.map((n) => n.id), ['n1', 'n2']);
  assert.equal(data.books[0].notes[0].ocr, 'manual');
  const md = toMarkdown(data);
  assert.match(md, /## ヒトとAI/);
  assert.match(md, /- p\.5 「一つ目」→ 感想/);
});
