# [114-1] Web Programming Final

Group 30 - 「NTUPOOP」  
組員：許元瑞、彭子桓

## Demo 影片連結
- `https://youtu.be/He-jr2eHJVw`

## 這個服務在做什麼？
出門在外，最怕哪一件事？那肯定是肚子突然劇痛，卻完全找不到廁所。  
**NTUPOOP** 是一個以「地圖＋社群互動」為核心的廁所地圖網站：不只是找廁所，而是讓「找廁所」變成一件有趣又有人情味的事。

## 你可以在地圖上
- 瀏覽各種公共廁所資訊
- 打卡紀錄「我曾在此安全下莊」
- 留下評論（乾淨嗎？有沒有衛生紙？）
- 回報問題、收藏愛用廁所
- 申請新增你私藏的神秘廁所

## 社群系統
為了讓大家更有動力打開網站，我們還加入了社群元素：
- 會員中心：個人資料管理、歷史紀錄、通知
- 成就系統 & 排行榜：你可以成為「屎帝」或「專業廁所評論家」！
- 遊樂場小遊戲：給你一個「上廁所也不無聊」的選擇

## Deployed 連結
- `https://ntupoop.vercel.app/`

## 使用/操作方式
- 使用者端：
  - 訪客可直接瀏覽地圖與部分功能頁面，在地圖上可點選地標查看資訊，並可點擊導航進行路線規劃。
  - 登入後可使用會員功能（收藏、評論/回報/申請、查看會員中心與個人紀錄等）。
  - 會員中心可編輯個人資料、查看通知/紀錄/成就/排行榜。
- 伺服器端：
  - 透過 API 路由提供地點、評論、回報、收藏、打卡、通知、排行榜等資料存取。
  - 註冊/登入使用驗證與雜湊存密碼，並以 session 機制控管會員權限。

## 使用之第三方套件、框架、程式碼
- 前端：Next.js / React / Tailwind CSS / react-hook-form / lucide-react / react-hot-toast / recharts
- 後端：Next.js API Routes / next-auth / Prisma / PostgreSQL（pg）/ zod / bcryptjs
- 第三方：Google Maps Platform（Google Maps JavaScript API）/ @vis.gl/react-google-maps

## 專題製作心得
許元瑞：感謝子桓發想了這個主題，是一個十分有用的服務。我自己真的有某次出門用到，這也讓我更加確信這服務是有用的。由於本學期的網服融合了 vibe coding，所以技術門檻大大降低了，更著重的是點子有不有趣、有沒有解決痛點？在開發的途中，常常在想怎麼把簡單的地圖服務做得好用，同時融入更多元素讓整體不要那麼單調呆版。最終我們呈現出了一個比較不同的地圖網站。希望大家會喜歡我們的 NTUPOOP。
彭子桓：上了Ric老師的網服課程之後我才開始用LLM輔助程式開發，深深的感受到LLM的強大，過去我手刻一兩天的網站現在只需要幾分鐘就能實現。
在讚嘆的同時我也在更重視設計的重要性，一個好的網頁不只是功能多、訊息量龐大，而是也要兼顧UI, UX, 以及打中使用者的需求，所以我們的期末專題不單單是做一個地圖，我們還加入了社群系統，讓用戶可以打卡、留言、回覆，還有活躍度排行榜以及成就系統，讓用戶之間的互動更緊密。
很感謝這堂課給我機會實作那麼多網站、學習了那麼多實用的程式語言。還要感謝我的組員元瑞、老朋友Cursor和Gemini 3 pro這學期的協助😄
## 如何在 localhost 安裝與測試之詳細步驟


### 0) 需要的環境
- Node.js：建議使用 **Node.js 20 LTS**（或至少 18+）
- 套件管理：npm（或 yarn 皆可，本 README 以 npm 為主）
- 資料庫：PostgreSQL（建議 14+）
- Google Maps：
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  - `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`（Advanced Markers 需要）


### 1) 下載專案與安裝依賴
在專案根目錄執行：

```bash
npm install
```

### 2) 建立資料庫（PostgreSQL）
請先建立一個資料庫（名稱可自訂，以下以 `ntupoop` 為例）。

如果你用 `psql`：

```bash
createdb ntupoop
```

或在 `psql` 裡：

```bash
CREATE DATABASE ntupoop;
```

### 3) 設定環境變數（.env）
在專案根目錄建立檔案 `.env`，內容範例如下（請把尖括號內容換成你的值）：

```bash
DATABASE_URL="postgresql://<USER>:<PASSWORD>@localhost:5432/ntupoop?schema=public"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="<YOUR_GOOGLE_MAPS_API_KEY>"
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID="<YOUR_GOOGLE_MAPS_MAP_ID>"
NEXTAUTH_SECRET="<YOUR_NEXTAUTH_SECRET>"
ADMIN_PASSWORD="<YOUR_ADMIN_PASSWORD>"
```

#### 產生 NEXTAUTH_SECRET（擇一）
Windows PowerShell：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4) 初始化資料庫 Schema（Prisma）
在專案根目錄執行（擇一即可；建議用 migrate）：

**方式 A：migrate（建議）**

```bash
npx prisma migrate dev --name init
```

**方式 B：db push**

```bash
npx prisma db push
```

### 5) 匯入測試資料（地點資料）
本專案提供兩份資料匯入腳本（資料檔案已在 repo 的 `data/` 內）：

#### 5-1 匯入「台灣公廁資料」（tw_public）
本資料取得於【環境衛生管理資訊系統】https://esms.moenv.gov.tw/eco/toilet/FindToilet.aspx?openExternalBrowser=1

```bash
npm run import:tw-public
```

（可選）驗證匯入結果：

```bash
npm run verify:tw-public
```

#### 5-2 匯入「7-ELEVEN 地點」（711）
本資料取得於【711電子地圖系統】https://emap.pcsc.com.tw/

```bash
npm run import:711
```

（可選）驗證匯入結果：

```bash
npm run verify:711
```

### 6) 啟動專案（localhost）

```bash
npm run dev
```

接著在瀏覽器開啟：
- `http://localhost:3000`

### 7) 登入/註冊方式（測試用）
- 一般會員：
  - 到 `/register` 註冊即可
  - 密碼規則：8–64 字元、需英數混用、需確認密碼一致
- 管理員（Admin）：
  - 到 `/admin` 登入
  - 帳號固定為：`admin`
  - 密碼為你在 `.env` 設定的：`ADMIN_PASSWORD`

### 8) 測試方式
#### 8-1 訪客模式
- 首頁地圖可瀏覽地點、點地標可看資訊
- 可點「導航」進行路線規劃（步行）

#### 8-2 會員功能（登入後）
- 地點：收藏 / 評論 / 回報 / 申請新增
- 會員中心：個人資料 / 通知 / 歷史紀錄 / 成就 / 排行榜
- 會員中心可修改密碼（同註冊規則）或個人簡介

#### 8-3 其他頁面
- 遊樂場：可進入小遊戲頁面


