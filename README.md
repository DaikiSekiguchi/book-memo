# 読書メモ (memo-app)

しおりを挟んだページを iPhone で撮影 → 文字を読み取り → ページ番号・所感を付けて保存する、自分専用のメモアプリ(PWA)。
保存したメモは書き出して、PC の `books import-memo` で本の資料ノート「引用・メモ」に取り込めます。

- サーバーなし。静的ファイルだけで動きます。データは端末のブラウザ内(IndexedDB)に保存されます。
- 文字の読み取りは 3 方式。設定画面で切り替えます。
  - **iPhone 標準の文字認識(初期設定・おすすめ・無料)**: 撮影した写真の文字を長押しして選択 →「コピー」→「クリップボードから貼り付け」。または、本文欄をタップして、キーボード上の 📷(テキストを読み取り)で本のページを映して取り込みます。iOS の標準機能(Live Text)を使うので、アプリは自動では読み取りません。
  - **端末内 Tesseract**: 無料・キー不要ですが、実際の本のページでは精度が低めです。
  - **Claude 画像入力**: 高精度。Anthropic の API キーが必要で、写真が API に送信され、利用量に応じた料金がかかります。キーは端末内に平文で保存されます。
- 読み取った文字は、必ず画面で確認・修正してから保存します。

## 試す(PC)

```powershell
python -m http.server 8765 --directory memo-app
# ブラウザで http://127.0.0.1:8765/ を開く
```

## iPhone で使う

公開先: https://daikisekiguchi.github.io/book-memo/ (GitHub Pages。リポジトリ: DaikiSekiguchi/book-memo、公開)
iPhone の Safari で開き、共有ボタン →「ホーム画面に追加」。コードは誰でも見られますが、メモのデータは各端末の中だけにあります。

**アプリを更新するとき**: `memo-app/` を直したら、公開用リポジトリへ反映します(`book-archive` 本体は公開しない)。

```powershell
git clone https://github.com/DaikiSekiguchi/book-memo $env:TEMP\book-memo-pub
Copy-Item memo-app\* $env:TEMP\book-memo-pub -Recurse -Force
cd $env:TEMP\book-memo-pub; git add -A; git commit -m "Update"; git push
```
反映は数分かかります。Service Worker のキャッシュを更新するときは、`sw.js` の `CACHE` の版数(`book-memo-v1`)を上げてください。

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
