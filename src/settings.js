// 設定は localStorage に保存する(使えない環境でも落ちないようにする)。

const KEY = 'book-memo-settings';
export const DEFAULTS = {
  engine: 'tesseract', // 'tesseract' | 'claude'
  vertical: false, // 縦書き(Tesseract のみ)
  apiKey: '',
  model: 'claude-sonnet-5-5',
};

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 保存できなくても動作は続ける */
  }
  return next;
}
