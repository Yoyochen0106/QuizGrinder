# 少女前線2風：介面調查筆記

> 用途：skins/gf2.* 的設計依據。只取版面語言、配色、字體節奏、動態，不使用任何角色、標誌、專有名詞或素材。
> 本次調查只有網路搜尋摘要可讀（WebFetch 被環境擋下，iopwiki 等無法開啟）；標「（自身知識）」的段落來自我對遊戲畫面的記憶，未經本次來源核對。

## 整體印象

- 回合制戰術 RPG，機制與 XCOM 系列相近；格子化戰場、掩體系統、可互動地形（終端、輸送帶）。（wikipedia 鏡像、game8、gamingonphone 摘要）
- PC 評論描述：小地圖上部署四名單位，在格子地圖上規劃移動完成目標；掩體各有規則。（christcenteredgamer 摘要）
- UI 評論：在功能與美感間取得平衡，走**極簡**路線，但字很小、選單很多。（gamingonphone 評測摘要）

## 配色（近似值，自身知識）

| 用途 | 色 |
|---|---|
| 底 | 炭灰／深橄欖 #15170f – #2a2e22 |
| 線條 | 灰綠 #444a36、細格線 |
| 重點 | 琥珀 #f2a12a、橘 #ff7a1a（可行動、選取、目標） |
| 我方／安全 | 橄欖綠 #8a9a3f |
| 敵方／危險 | 紅橘 #ef6a4c，常配斜紋 |

## 字體節奏（自身知識）

- 標題為寬、粗的無襯線大寫英文，字距開；常有模版噴字（stencil）般的斷筆。
- 數據用等寬字，前面帶小號英文代碼（例如 HP、AMMO 類標籤）；中文為一般黑體。

## 版面與元件（自身知識）

- 戰術地圖：俯視格子，移動範圍以藍色格、攻擊範圍以紅色格表示，路徑以虛線箭頭顯示；掩體以半盾／全盾小圖示標示。
- 側邊「戰術說明」面板：目標、敵情、地形說明，切角矩形面板＋左上角色條。
- 任務簡報：大數字、分段進度條（虛線式）。

## 動態（自身知識）

- 開機式進場：掃描線、文字逐行出現；選取格子有雷達脈衝。

## 本風格的實作對應

- 首頁戰術地圖：選一份考卷，每題一個六角格（固定 8 欄，odd-r 位移座標判斷相鄰）；迷霧／已佔領／交戰中由真實紀錄決定。
- 「規劃路線」只允許相鄰格，虛線路徑；「執行路線」依序作答；情報面板（題號、主題、出處、狀態）＋作答；任務簡報（本次正確率、佔領率）；小隊面板＝兩科真實數據。
- 切角面板、模版噴字英文代碼、分段進度條、掃描線開機進場、雷達脈衝。

## 參考來源

- https://gamingonphone.com/reviews/girls-frontline-2-exilium-game-review
- https://game8.co/articles/reviews/girls-frontline-2-exilium-gameplay-and-story-info
- https://www.christcenteredgamer.com/reviews/pc-mac/girls-frontline-2-exilium-pc
- https://pcgamer.com/games/anime-tactics-game-girls-frontline-2-exilium-has-landed-on-pc
- https://wiki.privacytools.io/wiki/GFL2?lang=en （wikipedia 鏡像）
- https://www.bluestacks.com/blog/app-reviews/girls-frontline-2-exilium-review-en.html
