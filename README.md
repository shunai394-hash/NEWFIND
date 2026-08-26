# NEWFIND

商品を発見するSNSのMVP。Instagram / TikTok 型の操作感で、投稿から外部EC・公式サイトへ送ります。NEWFIND 内で販売・決済・配送はしません。

## 動かし方

```bash
npm install
npm run dev
```

http://localhost:3000

Supabase の環境変数が未設定のときは、ブラウザ内のローカルモードでフィード・投稿・SNS機能が動きます。メールでアカウントを作ってください。

## Supabase に切り替える

1. 新しい Supabase プロジェクトを作成する
2. `supabase/migrations/001_init.sql` を SQL Editor で実行する
3. Authentication で Email / Google / Apple を有効化する
4. Redirect URL に `http://localhost:3000/auth/callback` を追加する
5. `.env.local` に URL と anon key を入れる

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

画像・動画は Supabase Storage の `media` バケットに保存します。

## Supabase migrations

SQL Editor で順に実行するか、CLI で適用してください。

1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_grants.sql`
3. `supabase/migrations/003_rls_grants_social.sql`（RLS/GRANT 再確認 + SNS URL カラム）

`permission denied for table ...` が出る場合は 002/003 の GRANT が未適用です。

## モバイル (Capacitor)

Web 版はそのまま Next.js です。ネイティブアプリは Capacitor WebView から **稼働中の Next.js** を読みます（`output: "export"` は使いません。OAuth の `/auth/callback` と動的ルートを壊さないため）。

```bash
# 1. Web を起動
npm run dev

# 2. WebView の向き先を指定して sync（初回や URL 変更時）
# iOS Simulator / ブラウザ相当:
set CAPACITOR_SERVER_URL=http://localhost:3000
npm run cap:sync

# Android Emulator からホスト PC の Next へ:
set CAPACITOR_SERVER_URL=http://10.0.2.2:3000
npm run cap:sync

# 3. ネイティブ IDE を開く
npm run cap:android
npm run cap:ios
```

- Android: Android Studio + SDK が必要（このマシンに未導入ならプロジェクト生成のみ可能）
- iOS: macOS + Xcode が必要（Windows では `ios/` の生成・編集のみ）
- 本番では `CAPACITOR_SERVER_URL` をデプロイ先 URL にし、Supabase Redirect URL に同じオリジンの `/auth/callback` を追加する

## PWA

現状は **導入しない**。ホーム画面追加は Capacitor 側で賄い、Service Worker と Cookie/OAuth の兼ね合いを避ける。Web 単体のインストール性が必要になったら別途検討する。

## 作っていないもの

商品マスタ、売上分配、独自EC、在庫、配送、高度なAI推薦。
