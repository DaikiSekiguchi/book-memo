# 読書メモ (memo-app)

しおりを挟んだページを iPhone で撮影 → 文字を読み取り → ページ番号・所感を付けて保存する、自分専用のメモアプリ(PWA)。
保存したメモは書き出して、PC の `books import-memo` で本の資料ノート「引用・メモ」に取り込めます。

- サーバーなし。静的ファイルだけで動きます。データは端末のブラウザ内(IndexedDB)に保存されます。
- 文字の読み取りは 2 方式。設定画面で切り替えます。
  - **端末内(Tesseract.js)**: 無料・API キー不要。初回は日本語データの読み込みに時間がかかります。縦書きの本は設定で「縦書き」を有効にします。
  - **Claude 画像入力**: 高精度。Anthropic の API キーが必要で、写真が API に送信され、利用量に応じた料金がかかります。キーは端末内に平文で保存されます。
- 読み取り結果は、必ず画面で確認・修正してから保存します。

## 試す(PC)

```powershell
python -m http.server 8765 --directory memo-app
# ブラウザで http://127.0.0.1:8765/ を開く
```

## iPhone で使う

iPhone で使うには、HTTPS で公開された場所(GitHub Pages、Cloudflare Pages など)に `memo-app/` を置く必要があります(オフライン対応の Service Worker が HTTPS を要求するため)。
公開すると URL が外部から見えるようになります(アプリにはあなたのデータは含まれません)。公開先の選択と実施は、あらかじめ相談してから行ってください。
開いたら Safari の共有ボタン →「ホーム画面に追加」。

同じ Wi-Fi の PC のサーバーに `http://<PCのIP>:8765/` でつなぐ試し方もできます(その場合、オフライン対応と自動更新は働きません)。

## 書き出しと取り込み

1. アプリの本棚で「書き出し」→ 共有シートから「ファイルに保存」(JSON と Markdown の 2 ファイル)
2. PC で、書き出された JSON を取り込む
   ```powershell
   books import-memo book-memo-2026-10-12.json --dry-run   # 内容を確認
   books import-memo book-memo-2026-10-12.json
   ```
   - ISBN(なければ題名)が一致する `books/*.md` の「## 引用・メモ」に `- p.57 「引用」→ 所感` の形式で追記します。
   - 取り込み済みのメモは ID で判別するので、同じファイルを何度取り込んでも重複しません。
   - 未登録の本は取り込まれません。先に `books add <ISBN>` で登録してください。

**バックアップ**: iPhone のホーム画面アプリは、ブラウザ側の都合で保存領域が消えることがあります。定期的に書き出してください。

## テスト

```powershell
node --test memo-app/tests/*.test.js          # 書き出し形式・ISBN・OCR 整形(Node.js が必要)
# ブラウザでの保存/削除: memo-app を配信して tests/browser-smoke.html を開く(PASS が並べば成功)
```

## ファイル

- `index.html` `styles.css` `src/main.js`(画面とルーティング)
- `src/model.js`(ISBN 正規化・書き出し形式。DOM 非依存) `src/db.js`(IndexedDB)
- `src/ocr/`(`tesseract.js` / `claude.js` / `index.js`) `src/image.js`(縮小・向き補正)
- `sw.js` `manifest.webmanifest` `icons/`
