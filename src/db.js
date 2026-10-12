// IndexedDB の薄いラッパー。ストアは books と notes の2つ。

const DB_NAME = 'book-memo';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('notes')) {
          const notes = db.createObjectStore('notes', { keyPath: 'id' });
          notes.createIndex('bookId', 'bookId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const result = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const putBook = (book) => run('books', 'readwrite', (s) => s.put(book));
export const getBook = (id) => run('books', 'readonly', (s) => s.get(id));
export const allBooks = () => run('books', 'readonly', (s) => s.getAll());
export const putNote = (note) => run('notes', 'readwrite', (s) => s.put(note));
export const getNote = (id) => run('notes', 'readonly', (s) => s.get(id));
export const allNotes = () => run('notes', 'readonly', (s) => s.getAll());
export const deleteNote = (id) => run('notes', 'readwrite', (s) => s.delete(id));

export async function notesOfBook(bookId) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction('notes', 'readonly').objectStore('notes').index('bookId').getAll(bookId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 本と、その本のメモをまとめて削除する。 */
export async function deleteBook(id) {
  const db = await open();
  const notes = await notesOfBook(id);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['books', 'notes'], 'readwrite');
    tx.objectStore('books').delete(id);
    for (const n of notes) tx.objectStore('notes').delete(n.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
