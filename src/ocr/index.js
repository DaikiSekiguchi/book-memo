import { claudeEngine } from './claude.js';
import { tesseractEngine } from './tesseract.js';

export const engines = { tesseract: tesseractEngine, claude: claudeEngine };

/** 設定に従って OCR を実行する。{ text, page } を返す。 */
export async function recognize(blob, settings, onProgress) {
  const engine = engines[settings.engine] ?? tesseractEngine;
  return engine.recognize(blob, {
    vertical: settings.vertical,
    apiKey: settings.apiKey,
    model: settings.model,
    onProgress,
  });
}
