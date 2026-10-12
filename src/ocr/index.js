import { claudeEngine } from './claude.js';
import { tesseractEngine } from './tesseract.js';

/** 自動では読み取らない。iPhone 標準の文字認識(Live Text)で、人が本文欄に取り込む。 */
export const manualEngine = {
  id: 'manual',
  label: 'iPhone 標準の文字認識',
  async recognize() {
    return { text: '', page: '' };
  },
};

export const engines = { manual: manualEngine, tesseract: tesseractEngine, claude: claudeEngine };

/** 設定に従って OCR を実行する。{ text, page } を返す。 */
export async function recognize(blob, settings, onProgress) {
  const engine = engines[settings.engine] ?? manualEngine;
  return engine.recognize(blob, {
    vertical: settings.vertical,
    apiKey: settings.apiKey,
    model: settings.model,
    onProgress,
  });
}
