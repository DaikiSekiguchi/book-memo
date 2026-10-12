// 端末内 OCR(Tesseract.js)。無料・API キー不要。日本語の横書き(jpn)/縦書き(jpn_vert)。

const SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let loading;
let worker;
let workerLang;

function loadLibrary() {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.onload = () => resolve(globalThis.Tesseract);
      s.onerror = () => {
        loading = undefined;
        reject(new Error('OCR ライブラリを読み込めませんでした。通信状態を確認してください。'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export const tesseractEngine = {
  id: 'tesseract',
  label: '端末内(Tesseract)',
  async recognize(blob, { vertical = false, onProgress } = {}) {
    const T = await loadLibrary();
    const lang = vertical ? 'jpn_vert' : 'jpn';
    if (!worker || workerLang !== lang) {
      if (worker) await worker.terminate();
      worker = await T.createWorker(lang, 1, {
        logger: (m) => onProgress?.(m.status, m.progress),
      });
      workerLang = lang;
    }
    const { data } = await worker.recognize(blob);
    // 日本語は文字間に空白が入りがちなので、日本語文字どうしの間の空白を詰める。
    const text = data.text.replace(/([　-鿿＀-￯])[ \t]+(?=[　-鿿＀-￯])/g, '$1').trim();
    return { text, page: '' };
  },
};
