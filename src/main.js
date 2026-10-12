import * as db from './db.js';
import { prepareImage } from './image.js';
import { buildExport, newId, normalizeIsbn, parsePage, toMarkdown } from './model.js';
import { engines, recognize } from './ocr/index.js';
import { loadSettings, saveSettings } from './settings.js';

const $app = document.getElementById('app');
const $title = document.getElementById('title');
const $back = document.getElementById('back');
const $toast = document.getElementById('toast');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let toastTimer;
function toast(message) {
  $toast.textContent = message;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
}

function setBar(title, back) {
  $title.textContent = title;
  if (back) {
    $back.hidden = false;
    $back.href = back.href;
    $back.textContent = back.label;
  } else {
    $back.hidden = true;
  }
}

// ---------- 本棚 ----------
async function viewShelf() {
  setBar('読書メモ');
  const [books, notes] = await Promise.all([db.allBooks(), db.allNotes()]);
  const count = new Map();
  for (const n of notes) count.set(n.bookId, (count.get(n.bookId) ?? 0) + 1);
  books.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  $app.innerHTML = `
    <a class="btn" style="display:block" href="#/book-new">＋ 本を追加</a>
    <div style="margin-top:16px">
      ${
        books.length
          ? books
              .map(
                (b) => `<a class="card" href="#/book/${esc(b.id)}">
                  <h2>${esc(b.title)}</h2>
                  <span class="muted">${esc(b.authors || '')}　メモ ${count.get(b.id) ?? 0} 件</span>
                </a>`,
              )
              .join('')
          : '<p class="empty">まだ本がありません。<br>「本を追加」から始めましょう。</p>'
      }
    </div>
    <div class="row"><button class="btn secondary" id="export">書き出し (JSON + Markdown)</button></div>`;
  document.getElementById('export').onclick = exportAll;
}

// ---------- 本の追加 ----------
function viewBookNew() {
  setBar('本を追加', { href: '#/', label: '‹ 本棚' });
  $app.innerHTML = `
    <form id="f">
      <label for="title-in">題名(必須)</label>
      <input type="text" id="title-in" required autocomplete="off">
      <label for="authors-in">著者</label>
      <input type="text" id="authors-in" autocomplete="off">
      <label for="isbn-in">ISBN(任意。本のアーカイブと自動で結びつきます)</label>
      <input type="text" id="isbn-in" inputmode="numeric" autocomplete="off" placeholder="978…">
      <div class="row"><button class="btn" type="submit">追加</button></div>
    </form>`;
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const title = document.getElementById('title-in').value.trim();
    const rawIsbn = document.getElementById('isbn-in').value.trim();
    const isbn = rawIsbn ? normalizeIsbn(rawIsbn) : '';
    if (rawIsbn && !isbn) {
      toast('ISBN が正しくありません(10桁または13桁)');
      return;
    }
    if (!title) return;
    const book = {
      id: newId(),
      title,
      authors: document.getElementById('authors-in').value.trim(),
      isbn,
      createdAt: new Date().toISOString(),
    };
    await db.putBook(book);
    location.hash = `#/book/${book.id}`;
  };
}

// ---------- 本のページ(メモ一覧) ----------
async function viewBook(bookId) {
  const book = await db.getBook(bookId);
  if (!book) {
    location.hash = '#/';
    return;
  }
  setBar(book.title, { href: '#/', label: '‹ 本棚' });
  const notes = (await db.notesOfBook(bookId)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  $app.innerHTML = `
    <a class="btn" style="display:block" href="#/book/${esc(bookId)}/new">📷 ページを撮影してメモ</a>
    <input type="search" id="q" placeholder="メモを検索" style="margin-top:12px">
    <div id="list" style="margin-top:12px"></div>
    <div class="row"><button class="btn danger" id="del">この本を削除</button></div>`;
  const $list = document.getElementById('list');
  const render = (q = '') => {
    const hits = notes.filter((n) => `${n.page} ${n.quote} ${n.comment}`.includes(q));
    $list.innerHTML = hits.length
      ? hits
          .map(
            (n) => `<a class="card note" href="#/note/${esc(n.id)}">
              ${n.page ? `<span class="page">p.${esc(n.page)}</span>` : ''}${esc(n.quote)}
              ${n.comment ? `<span class="comment">${esc(n.comment)}</span>` : ''}
              <span class="muted">${esc(n.createdAt.slice(0, 10))}</span>
            </a>`,
          )
          .join('')
      : '<p class="empty">メモがありません。</p>';
  };
  render();
  document.getElementById('q').oninput = (e) => render(e.target.value.trim());
  document.getElementById('del').onclick = async () => {
    if (!confirm(`「${book.title}」とメモ ${notes.length} 件を削除します。よろしいですか?`)) return;
    await db.deleteBook(bookId);
    location.hash = '#/';
  };
}

// ---------- メモの作成・編集(撮影 → OCR → 編集 → 保存) ----------
async function viewNote({ bookId, noteId }) {
  const existing = noteId ? await db.getNote(noteId) : null;
  const book = await db.getBook(existing ? existing.bookId : bookId);
  if (!book) {
    location.hash = '#/';
    return;
  }
  setBar(existing ? 'メモを編集' : 'メモを追加', { href: `#/book/${book.id}`, label: '‹ 戻る' });
  const settings = loadSettings();
  let ocrKind = existing?.ocr ?? 'manual';

  $app.innerHTML = `
    ${
      existing
        ? ''
        : `<div class="row">
            <label class="btn" for="cam" style="margin:0">📷 撮影</label>
            <label class="btn secondary" for="lib" style="margin:0">🖼 写真を選ぶ</label>
          </div>
          <input type="file" id="cam" accept="image/*" capture="environment">
          <input type="file" id="lib" accept="image/*">
          <img id="preview" class="preview" alt="" hidden>
          <div id="status" class="status"></div>`
    }
    <label for="page">ページ</label>
    <input type="text" id="page" inputmode="numeric" value="${esc(existing?.page ?? '')}">
    <label for="quote">本文(引用)</label>
    <textarea id="quote">${esc(existing?.quote ?? '')}</textarea>
    <label for="comment">所感・メモ</label>
    <textarea id="comment">${esc(existing?.comment ?? '')}</textarea>
    <div class="row">
      <button class="btn" id="save">保存</button>
      ${existing ? '<button class="btn danger" id="del">削除</button>' : ''}
    </div>`;

  const $status = document.getElementById('status');
  const $preview = document.getElementById('preview');
  const $quote = document.getElementById('quote');
  const $page = document.getElementById('page');

  async function onPicked(file) {
    if (!file) return;
    $preview.src = URL.createObjectURL(file);
    $preview.hidden = false;
    $status.textContent = '画像を準備しています…';
    try {
      const blob = await prepareImage(file);
      const engine = engines[settings.engine];
      $status.textContent = `${engine.label}で読み取り中…(初回は言語データの読み込みで時間がかかります)`;
      const result = await recognize(blob, settings, (st, p) => {
        $status.textContent = `${engine.label}: ${st}${typeof p === 'number' ? ` ${Math.round(p * 100)}%` : ''}`;
      });
      $quote.value = result.text;
      if (result.page && !$page.value) $page.value = result.page;
      ocrKind = settings.engine;
      $status.textContent = '読み取りました。誤りがないか確認して、必要なら直してください。';
    } catch (err) {
      $status.textContent = `読み取りに失敗しました: ${err.message}`;
    }
  }
  if (!existing) {
    document.getElementById('cam').onchange = (e) => onPicked(e.target.files[0]);
    document.getElementById('lib').onchange = (e) => onPicked(e.target.files[0]);
  }

  document.getElementById('save').onclick = async () => {
    const quote = $quote.value.trim();
    const comment = document.getElementById('comment').value.trim();
    if (!quote && !comment) {
      toast('本文か所感を入力してください');
      return;
    }
    const now = new Date().toISOString();
    await db.putNote({
      id: existing?.id ?? newId(),
      bookId: book.id,
      page: parsePage($page.value),
      quote,
      comment,
      ocr: ocrKind,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    toast('保存しました');
    location.hash = `#/book/${book.id}`;
  };
  if (existing) {
    document.getElementById('del').onclick = async () => {
      if (!confirm('このメモを削除します。よろしいですか?')) return;
      await db.deleteNote(existing.id);
      location.hash = `#/book/${book.id}`;
    };
  }
}

// ---------- 設定 ----------
function viewSettings() {
  setBar('設定', { href: '#/', label: '‹ 本棚' });
  const s = loadSettings();
  $app.innerHTML = `
    <label for="engine">文字の読み取り方式</label>
    <select id="engine">
      <option value="tesseract" ${s.engine === 'tesseract' ? 'selected' : ''}>端末内(無料・キー不要)</option>
      <option value="claude" ${s.engine === 'claude' ? 'selected' : ''}>Claude 画像入力(高精度・API キーが必要)</option>
    </select>
    <label><input type="checkbox" id="vertical" ${s.vertical ? 'checked' : ''}> 縦書きの本(端末内方式のみ)</label>
    <label for="key">Anthropic API キー</label>
    <input type="password" id="key" value="${esc(s.apiKey)}" autocomplete="off" placeholder="sk-ant-…">
    <div class="warn">API キーはこの端末のブラウザ内に平文で保存されます。撮影した写真は Anthropic の API に送信され、利用量に応じた料金がかかります。自分専用の端末でのみ使ってください。</div>
    <label for="model">モデル</label>
    <input type="text" id="model" value="${esc(s.model)}" autocomplete="off">
    <div class="row"><button class="btn" id="save">保存</button></div>`;
  document.getElementById('save').onclick = () => {
    saveSettings({
      engine: document.getElementById('engine').value,
      vertical: document.getElementById('vertical').checked,
      apiKey: document.getElementById('key').value.trim(),
      model: document.getElementById('model').value.trim() || 'claude-sonnet-5-5',
    });
    toast('設定を保存しました');
  };
}

// ---------- 書き出し ----------
async function exportAll() {
  const [books, notes] = await Promise.all([db.allBooks(), db.allNotes()]);
  const data = buildExport(books, notes);
  if (data.books.length === 0) {
    toast('書き出すメモがありません');
    return;
  }
  const stamp = data.exported_at.slice(0, 10);
  const files = [
    new File([JSON.stringify(data, null, 2)], `book-memo-${stamp}.json`, { type: 'application/json' }),
    new File([toMarkdown(data)], `book-memo-${stamp}.md`, { type: 'text/markdown' }),
  ];
  try {
    if (navigator.canShare?.({ files })) {
      await navigator.share({ files, title: '読書メモ' });
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
  }
  // 共有シートが使えない場合はダウンロードにフォールバックする。
  for (const f of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

// ---------- ルーター ----------
async function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  window.scrollTo(0, 0);
  try {
    let m;
    if (hash === '/') await viewShelf();
    else if (hash === '/book-new') viewBookNew();
    else if (hash === '/settings') viewSettings();
    else if ((m = hash.match(/^\/book\/([^/]+)\/new$/))) await viewNote({ bookId: m[1] });
    else if ((m = hash.match(/^\/book\/([^/]+)$/))) await viewBook(m[1]);
    else if ((m = hash.match(/^\/note\/([^/]+)$/))) await viewNote({ noteId: m[1] });
    else location.hash = '#/';
  } catch (err) {
    $app.innerHTML = `<p class="warn">表示中にエラーが起きました: ${esc(err.message)}</p>`;
  }
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    /* オフライン対応が無効になるだけ */
  });
}

