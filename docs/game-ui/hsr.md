# 崩壞：星穹鐵道風：介面調查筆記

> 用途：skins/hsr.* 的設計依據。只取版面語言、配色、字體節奏、動態，不使用任何角色、標誌、專有名詞、命途名稱或素材。
> 本次調查只有網路搜尋摘要可讀（WebFetch 被環境擋下）；標「（自身知識）」的段落來自我對遊戲畫面的記憶，未經本次來源核對。

## 整體印象

- 評論普遍稱讚宇宙題材的畫面「非常好看」，但也有人認為戰鬥 UI 與選單相較於美術略顯平淡、地圖被切成多段不易導覽。（psu.com 評測、rpghq 論壇、clutchpoints 摘要）
- 同人製作的「星鐵風 UI 素材包」把風格歸納為：**金色細框、標題條、文字框、面板**。（acrock itch.io 商品描述）
- 模擬宇宙：每次戰鬥／事件後從數個「祝福」中三選一，同一路線的祝福疊滿可解鎖特殊能力；超過 150 種祝福。（siliconera、pushsquare、sportskeeda 攻略摘要）

## 配色（近似值，自身知識）

| 用途 | 色 |
|---|---|
| 底 | #0a0d18 – #141a2e 深藍黑星空，帶紫藍星雲 |
| 玻璃面板 | rgba(30, 38, 66, .6) 疊背景模糊 |
| 線條 | 白色 15–35% 透明的細線 |
| 金色重點 | #e5c47f – #d5ae62（選取、主要按鈕、等級） |
| 狀態 | 綠 #73d9b0、紅 #ff8585 |

## 字體節奏（自身知識）

- 英文標題為**斜體、偏窄的粗體無襯線**，常配極小字距拉開的大寫英文標籤；中文標題同樣傾斜。
- 數字（等級、時間、層數）使用斜體粗數字，視覺上像列車儀表。

## 版面與元件（自身知識）

- 主選單像手機：右上一排圖示、左側大標題，切換頁面時大標題從右側滑入。
- 角落常見**L 形金色角括號**、切角（chamfer）矩形與菱形。
- 戰鬥：左側直式「行動序」列出接下來行動的單位頭像，當前行動者最大；本風格改為上方橫式、以題目代幣代替頭像。
- 模擬宇宙祝福選擇：三張直立卡片並排，卡上方大圖示、名稱斜體，滑過時卡片上浮。
- 星軌航線圖：行星節點以弧線串連，已解鎖段落發光。

## 動態（自身知識）

- 頁面切換：快速橫向滑入＋淡入；選取時白色外框閃光。
- 環境：星點閃爍、星雲緩慢漂移；倒數條是一條會縮短的發光細線。

## 本風格的實作對應

- 首頁「星圖航線」：主題＝沿 Catmull-Rom 平滑軌道排列的站點，圓環＝已練比例，已到訪段落為金色。
- 「闖關挑戰」：3 層 × 5 題、耐久 3、每題限時；每層通過後三選一增益（延長時間／刪去一個錯誤選項（下 2 題）／答錯不中斷），只影響下一層；上方行動序代幣；結算與最佳層數存 skinData.hsr。
- 玻璃面板＋金角括號、斜體窄標題、切角按鈕、橫向滑入轉場、星點閃爍。

## 參考來源

- https://acrock.itch.io/star-rail-frame-ac
- https://www.psu.com/reviews/honkai-star-rail-ps5-review/
- https://clutchpoints.com/honkai-star-rail-review
- https://esports.gg/news/honkai-star-rail/honkai-star-rail-review-persona-in-spaaaaaaace
- https://www.siliconera.com/tips-for-picking-honkai-star-rail-simulated-universe-blessings/
- https://pushsquare.com/guides/honkai-star-rail-simulated-universe-explained-and-how-to-earn-points
- https://www.sportskeeda.com/esports/best-simulated-universe-blessings-honkai-star-rail
