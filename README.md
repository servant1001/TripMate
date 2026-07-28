# TripMate 旅伴

TripMate 是一個多人旅行協作網站，支援旅伴共同規劃行程、記錄支出、整理購物與行李、管理預訂、收藏景點，以及追蹤旅行中的支付工具、保險與緊急資訊。

目前專案已從單純 MVP 擴充為可實際操作的旅行工作台，前端以 Vue 3 + Element Plus 建構，資料層使用 Firebase Authentication 與 Realtime Database，圖片上傳則透過 Cloudinary + Cloudflare Worker signed upload。

## 目前功能

- 旅行管理
  - 建立 / 編輯旅行
  - 旅行封面圖片
  - 邀請碼加入旅行
  - 成員管理與角色限制

- 每日行程
  - 共用行程、自由活動、個人行程
  - 地點群組、解散群組、刪除群組
  - 行程拖曳排序
  - 多選建立群組、批次刪除、全選 / 取消全選
  - 從旅遊收藏快速帶入地點、圖片與 Google Maps 連結
  - 交通行程支援出發 / 抵達站

- 旅行開銷
  - 支出建立、編輯、刪除
  - 成員分攤與結算建議
  - 預算 / 個人預算顯示

- 待辦、行李、預訂、購物、收藏、相簿、地圖
  - 旅行待辦與個人待辦
  - 行李清單拖曳排序與分類
  - 預訂管理
  - 購物清單、關聯行程、批次加入關聯行程
  - 台灣售價欄位、最新參考匯率換算與當地 / 台灣比價
  - 旅遊收藏分類、篩選、複製、帶入行程
  - 相簿照片與地圖檢視

- 支付與回饋
  - 個人支付工具管理
  - 回饋規則、活動登錄、回饋上限
  - 基礎回饋 / 加碼回饋分開計算
  - 付款明細篩選、摘要與排序

- 旅行保險與緊急資訊
  - 保單資訊
  - 保障內容
  - 緊急聯絡資訊

## 技術架構

- Frontend：Vue 3、TypeScript、Vite、Element Plus
- Auth / Database：Firebase Authentication、Realtime Database
- Upload：Cloudinary
- Secure API：Cloudflare Worker
- Hosting：Firebase Hosting
- Exchange rates：Frankfurter API（由 Cloudflare Worker 代理並快取）

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

如果要部署到正式 Firebase Hosting，可執行：

```bash
firebase deploy --only hosting --project tripmate-b3f9d
```

如果要部署 TripMate API Worker，可在 `worker/` 目錄執行：

```bash
.\node_modules\.bin\wrangler.cmd deploy
```

## 資料與服務

`src/services/firebase.ts` 已建立 Firebase Authentication 與 Realtime Database 初始化入口；設定 `.env` 後可接入正式 Firebase 專案。未提供憑證時，介面會以瀏覽器本機資料作為可操作的示範資料層，避免留下無法操作的按鈕。封面上傳採 Cloudinary signed upload；範例 Worker 位於 `workers/cloudinary-signature.ts`，API Secret 僅可放在 Worker 的 secret 中，絕不可放入前端。專案不使用 Firebase Storage。

啟用正式模式前，請在 Firebase Console 開啟 Email/Password 與 Google 登入方式，並將 `firebase.database.rules.json` 內容貼入 Realtime Database 的 Rules 分頁後發布。

`worker/` 包含 Cloudflare Worker：它會驗證 Firebase ID Token、簽署 Cloudinary 上傳、安全處理邀請碼加入旅行，並提供購物清單使用的最新參考匯率 endpoint（`/v1/exchange-rate`）。部署前請設定 `CLOUDINARY_CLOUD_NAME`、`CLOUDINARY_API_KEY`、`CLOUDINARY_API_SECRET`、`FIREBASE_WEB_API_KEY`、`FIREBASE_SERVICE_ACCOUNT_JSON` 五個 Worker Secret；前端不會取得任何 Secret。

## 購物清單比價規則

- 商品若已購買，會優先使用實際價格換算台幣。
- 商品若尚未購買，會使用預估價格換算台幣。
- 若商品本身已是 `TWD`，則直接與 `台灣售價` 比較。
- 若商品幣別不是 `TWD`，前端會透過 Worker 取得最新參考匯率，再換算成台幣與 `台灣售價` 比較。
- 介面中的比價結果屬於「最新參考匯率估算」，不代表實際刷卡入帳或換匯成交價格。
