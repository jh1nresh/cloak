# Spec: Cloak Mobile App (Expo)

**Goal:** 把 Cloak virtual try-on 做成原生 iOS app，支援 Share Extension（從任何電商 app 一鍵試衣）和 App Clip（掃 QR 零安裝試衣）

---

## Inputs / Outputs

- **Input:** 用戶頭像照片（onboarding 拍攝或選取）+ 衣服圖片（Share Extension 傳入 or 手動上傳）
- **Output:** 試穿結果圖，可下載 / 分享

---

## Tech Stack

- **Framework:** Expo SDK 52（React Native，TypeScript）
- **Backend:** 沿用現有 Next.js API（https://cloak-tau.vercel.app）
  - `POST /api/tryon` → try-on 主邏輯
  - `POST /api/avatar` → 上傳頭像
  - `GET /api/tryon/[id]` → 取得結果
- **套件：**
  - `expo-image-picker` → 選照片
  - `expo-camera` → 拍照
  - `expo-file-system` → 本地存圖
  - `expo-sharing` → 分享
  - `expo-media-library` → 儲存到相簿
  - `expo-share-extension` → Share Extension target
  - `expo-apple-targets` → App Clip target

---

## App 結構（Screens）

### 主 App
```
/ (Splash)
  → /onboarding  (拍攝/上傳頭像，存到 AsyncStorage)
  → /tryon       (上傳衣服圖 or 從 Share Extension 接收)
  → /result/[id] (試穿結果 + 下載 + 分享)
```

### Share Extension
- 用戶在 Safari/ZARA/Shein 按「分享」→ 選 Cloak
- Extension 接收到 URL 或圖片
- 若是 URL → 呼叫 `/api/scrape-garment` 取得衣服圖
- 若是圖片 → 直接用
- 開啟 Cloak app 的 /tryon 頁並帶入衣服圖

### App Clip
- 輕量版，只有 /tryon + /result
- 無 onboarding（第一次用要拍照）
- 結果頁加「下載完整 Cloak」CTA

---

## Acceptance Criteria

- [ ] `npx expo start` 可在 iOS simulator 跑
- [ ] Onboarding：拍照或選圖 → 上傳到 `/api/avatar` → 本地存 userId + avatarUrl
- [ ] Try-on：上傳衣服圖 → 呼叫 `/api/tryon` → 跳轉結果頁（20-30s loading）
- [ ] Result：顯示試穿圖 → 下載到相簿 → 分享連結
- [ ] Share Extension：從 Safari 分享 URL → Cloak 接收並自動 scrape → 進入試穿
- [ ] Share Extension：從任何 app 分享圖片 → Cloak 接收 → 進入試穿
- [ ] App Clip：單獨可跑，只包含 tryon + result
- [ ] TypeScript 無 type error
- [ ] 現有 Next.js API 不需修改

---

## Out of Scope

- Android（之後再說）
- 登入系統（Privy 之後加）
- Fashn.ai 換 Replicate（另一張 ticket）
- 批量試穿 / 服裝庫
- TestFlight 上架流程
