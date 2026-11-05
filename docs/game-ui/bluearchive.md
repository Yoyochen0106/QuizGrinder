# 蔚藍檔案風：介面調查筆記

> 用途：skins/bluearchive.* 的設計依據。只取版面語言、配色、字體節奏、動態，不使用任何角色、光環圖樣、標誌、專有名詞或素材。
> 本次調查只有網路搜尋摘要可讀（WebFetch 被環境擋下）；找不到公開的 UI 設計分析或官方字體資訊。標「（自身知識）」的段落來自我對遊戲畫面的記憶，未經本次來源核對。

## 整體印象

- 美術被描述為「乾淨的線條、柔和的上色」。（shapes.inc 粉絲站摘要）
- 遊戲內聊天系統可和角色傳訊、貼圖並觸發劇情事件；隨好感度解鎖。（pixiv 百科、appgamer 攻略摘要）
- 大廳可展示角色；「課程表」與咖啡廳是提升好感的主要互動。（bluestacks 新手指南摘要）
- 有人另外做了仿聊天介面的 Telegram 主題與 Flutter UI，顯示其聊天畫面辨識度很高。（awesome.ecosyste.ms 列表摘要）

## 配色（近似值，自身知識）

| 用途 | 色 |
|---|---|
| 主色天藍 | #1e9cf0 – #4fb8ff |
| 底 | 白 #ffffff、淡藍白 #eef5fb，帶淡網點 |
| 深字 | 藏青 #2b3f5c |
| 主要按鈕 | 黃 #ffe14d → #ffd93b，深字 |
| 聊天 App 標題列 | 粉 #ff8fab 前後 |
| 提醒 | 粉紅小圓標 |

## 字體節奏（自身知識）

- 圓潤、粗重的無襯線字；英文數字多用粗的圓角字並常傾斜；標題常斜體。官方字體名稱本次查不到。→ 以 Nunito 800/900＋Noto Sans TC 近似。

## 版面與元件（自身知識）

- 大廳：上方資源列（多個圓角膠囊，左端圖示）；右側直式選單磚；底部一排主要功能；右下大按鈕。
- 按鈕與面板大量用**平行四邊形（skewX）**、斜切的藍色色塊與三角碎片；背景有淺色網點與斜向光帶。
- 聊天：粉色標題列、左側對方頭像＋白色泡泡、自己的回覆為藍色泡泡；選項以整列按鈕呈現在底部。
- 課程表：一週格子，選時段與地點上課。

## 動態（自身知識）

- 轉場：藍白斜向色塊從畫面一側掃過（斜切擦除）。
- 按鈕按下有下沉；訊息泡泡彈出；圖示輕微上下浮動。

## 本風格的實作對應

- 大廳：頂部資源列（今日作答、連續天數、待複習）、右側平行四邊形選單磚、今日課程橫幅＋黃色「上課」。
- 訊息 App：家教機器人逐題傳訊，回覆按鈕作答，批改與解析回傳訊息；複習模式以錯題本盒子規則記錄。
- 課程表：七天各排一個主題（skinData.bluearchive），可依弱點自動排課。
- 斜向藍白擦除進場、網點底、雲朵漂浮。

## 參考來源

- https://shapes.inc/fandom/blue-archive/author
- https://dic.pixiv.net/en/comment/view/MomoTalk
- https://www.appgamer.com/blue-archive/strategy-guide/relationship-rank-guide
- https://www.bluestacks.com/ar/blog/game-guides/blue-archive/ba-beginner-guide-ar.html
- https://awesome.ecosyste.ms/topics/bluearchive
- https://www.wikiwand.com/en/articles/Blue_Archive
