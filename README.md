# TripMate 旅伴

多人旅行協作 MVP：旅行清單、旅行建立、成員／邀請碼、每日行程、個人與共同開銷及結算。

## 開始使用

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## 驗證

```bash
pnpm type-check
pnpm build
```

## 資料與服務

`src/services/firebase.ts` 已建立 Firebase Authentication 與 Realtime Database 初始化入口；設定 `.env` 後可接入正式 Firebase 專案。未提供憑證時，介面會以瀏覽器本機資料作為可操作的示範資料層，避免留下無法操作的按鈕。封面上傳採 Cloudinary signed upload；範例 Worker 位於 `workers/cloudinary-signature.ts`，API Secret 僅可放在 Worker 的 secret 中，絕不可放入前端。專案不使用 Firebase Storage。

啟用正式模式前，請在 Firebase Console 開啟 Email/Password 與 Google 登入方式，並將 `firebase.database.rules.json` 內容貼入 Realtime Database 的 Rules 分頁後發布。

`worker/` 包含 Cloudflare Worker：它會驗證 Firebase ID Token、簽署 Cloudinary 上傳並安全處理邀請碼加入旅行。部署前請設定 `CLOUDINARY_CLOUD_NAME`、`CLOUDINARY_API_KEY`、`CLOUDINARY_API_SECRET`、`FIREBASE_WEB_API_KEY`、`FIREBASE_SERVICE_ACCOUNT_JSON` 五個 Worker Secret；前端不會取得任何 Secret。
