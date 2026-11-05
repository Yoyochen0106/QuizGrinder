# 原神風：介面調查筆記

> 用途：skins/genshin.* 的設計依據。只取版面語言、配色、字體節奏、動態，不使用任何角色、標誌、專有名詞、元素符號或素材。
> 本次調查只有網路搜尋摘要可讀（WebFetch 被環境擋下，無法開原頁）；公開的 UI 設計分析很少。標「（自身知識）」的段落來自我對遊戲畫面的記憶，未經本次來源核對。

## 整體印象

- 介面被形容為「乾淨的線條、柔和的漸層」，選單、圖示、地圖與戰鬥介面一致。（calpoly 部落格摘要，來源品質普通）
- 地圖：拉遠時在區域名稱下方顯示**探索度百分比**；寶箱與**傳送錨點**會提高探索度；一個區域要所有子區都 100% 才算 100%。（gamerjournalist、gurugamer 等攻略摘要）
- 冒險等級（帳號等級）由任務、探索、每日委託等累積經驗；每日委託是最穩定的經驗來源。（shacknews、thegamer 摘要）
- 登入畫面與選單大量使用天空／星座紋樣。（fandom Login Menu 摘要）

## 配色（近似值，自身知識）

| 用途 | 色 |
|---|---|
| 選單底（深） | #3b4255 – #2e3446 深石板藍，半透明疊模糊 |
| 面板（羊皮紙） | #ece5d8、#f4efe4；深字 #495366 |
| 金色描邊 | #d3bc8e、深金 #b99a5f |
| 高光 | #ffe6a6 暖金光暈、確認圖示黃 #f2c95c |
| 傳送點藍 | #7fd3ea → #3c9fc0 |

## 字體節奏

- 中日文 UI 字為官方以「漢儀文黑 85W」修改的專用字（粗、筆畫端圓潤的黑體）；拉丁字另用一套字。（fandom Typeface 頁鏡像、madegooddesigns 摘要）→ 本風格以 Noto Sans TC 700/900 近似，標題用 Noto Serif TC 增加古典感。
- 數字偏幾何、無襯線；百分比與等級數字粗體。（自身知識）

## 版面與元件（自身知識）

- 大世界 HUD：**右上角一排圓形圖示按鈕**（半透明深底、米白線條圖示），左上小地圖。
- 對話框／確認框：上方深色標題列＋米白內容區，按鈕是**膠囊形、左端嵌一顆圓形圖示**（確認＝黃圈、取消＝深圈）。
- 框線：細金線＋外圈半透明白，邊緣中央常有**菱形小飾件**；選取時外圈出現暖金光暈。
- 地圖：手繪風格陸塊、海面淡藍綠、區域名白字＋探索度；傳送點是發光的藍色尖菱形圖示；右下角大按鈕「傳送」。
- 每日委託：清單 4 項，每項左側圓形圖示、右側狀態；全部完成後另有領取步驟（本風格不做獎勵領取，只顯示完成）。

## 動態（自身知識）

- 開啟選單：背景模糊加深＋面板由下往上淡入、輕微放大。
- 場景切換：白色漸亮後淡出；按鈕按下有縮小回彈與金色描邊閃光。
- 環境：空中漂浮的光點、雲影緩慢移動。

## 本風格的實作對應

- 首頁＝「知識大陸」：每個主題一塊不規則海岸線的陸塊（以主題名雜湊產生多邊形），雲霧濃度＝1−已練比例；探索度徽章、傳送錨點（練過即點亮）。
- 區域面板「傳送」＝練該主題；每日委託 4 題以日期為種子固定一天；冒險等級＝累積答對。
- 頂部右側圓形選單鈕、膠囊按鈕＋圓形圖示、菱形飾件、暖金光暈、白光進場、漂浮光點。

## 參考來源

- https://genshin-impact.fandom.com/wiki/Login_Menu
- https://sivegame.netlify.app/host-https-genshin-impact.fandom.com/wiki/Typeface （fandom Typeface 頁鏡像）
- https://madegooddesigns.com/genshin-impact-font/
- https://grandavehousing.calpoly.edu/blog/genshin-impact-exploring-diverse-artistic-styles-1764800995
- https://gamerjournalist.com/how-to-achieve-100-exploration-progress-in-genshin-impact/
- https://gurugamer.com/mobile-games/genshin-impact-exploration-progress-19895
- https://shacknews.com/article/120902/how-to-raise-your-adventure-rank-genshin-impact
- https://www.thegamer.com/genshin-impact-best-ways-increase-adventure-rank/
