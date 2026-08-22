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

## 作っていないもの

商品マスタ、売上分配、独自EC、在庫、配送、高度なAI推薦。
