// Claude の画像入力で文字起こしする。API キーは設定画面で入れたときだけ有効。
// ブラウザから直接呼ぶため、キーは端末の localStorage に平文で残る(自分専用の利用前提)。

import { blobToBase64 } from '../image.js';
import { extractPageMarker } from '../model.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export const PROMPT =
  'これは日本語の本のページを撮影した写真です。ページの本文を、見える通りに文字起こししてください。' +
  '縦書きの場合は読む順(右の行から左へ)に並べてください。段落ごとに改行し、行の途中の折り返しでは改行しないでください。' +
  '推測で文字を補わず、読めない箇所は「□」にしてください。' +
  'ページ番号が見える場合だけ、最後の行に「[ページ: 数字]」と書いてください。説明や前置きは不要です。';

export const claudeEngine = {
  id: 'claude',
  label: 'Claude(画像入力)',
  async recognize(blob, { apiKey, model } = {}) {
    if (!apiKey) throw new Error('設定で API キーを入力してください。');
    const data = await blobToBase64(blob);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.json()).error?.message ?? '';
      } catch {
        /* 本文が JSON でない場合は無視 */
      }
      throw new Error(`Claude API エラー (${res.status}) ${detail}`.trim());
    }
    const body = await res.json();
    const text = (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return extractPageMarker(text);
  },
};
