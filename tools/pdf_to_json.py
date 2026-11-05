"""用 Gemini 把 pdfs/ 的考卷 PDF 轉成結構化 JSON → data/raw/

這是題庫的「第一手抽取」，品質有限（詳見 docs/QA_REPORT.md）；人工修正請寫在
data/overrides/<exam_id>.json，不要直接改 data/raw，之後由 tools/build_bank.py 合併。

需要：pip install -r requirements.txt、環境變數 GEMINI_API_KEY（或 GOOGLE_API_KEY）。
用法：
  python3 tools/pdf_to_json.py                       # 轉換所有尚未轉換的 PDF
  python3 tools/pdf_to_json.py pdfs/某份考卷.pdf      # 只轉指定檔案
  python3 tools/pdf_to_json.py --model gemini-2.5-pro --force pdfs/某份考卷.pdf
新增考卷後別忘了在 data/exams.json 登錄。
"""
import argparse
import os
import pathlib
import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError
from typing import List, Literal, Dict, Any

# --- 1. 定義 Pydantic 結構 ---

# 定義題目的選項結構
class Options(BaseModel):
    A: str = Field(description="選項 A 的內容")
    B: str = Field(description="選項 B 的內容")
    C: str = Field(description="選項 C 的內容")
    D: str = Field(description="選項 D 的內容")

# 定義單個考古題的結構
class ExamProblem(BaseModel):
    year: int = Field(description="考試年份 (例如: 111)")
    exam_number: str = Field(description="試題編號或組別 (例如: '1')")
    source: str = Field(description="原始檔案名稱")
    number: int = Field(description="題目序號 (1 到 50)")
    subject: Literal["process", "industry"] = Field(description="題目主題類別，必須是 'process' 或 'industry'")
    question: str = Field(description="完整的題目內容")
    options: Options = Field(description="包含 A, B, C, D 四個選項的物件")
    answer: str = Field(description="正確答案，必須是 A, B, C, 或 D 之一")

# 定義最終的輸出結構
class ExamSet(BaseModel):
    problems: List[ExamProblem] = Field(description="包含所有 50 道考古題的列表")


# --- 2. 主要處理函數 ---

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = str(ROOT / 'data' / 'raw')
MODEL = 'gemini-2.5-flash'
FORCE = False


def extract_exams_from_pdf(file_path: str):
    """
    上傳 PDF 檔案，並要求 Gemini Flash Lite 提取結構化資料。
    """
    if not os.path.exists(file_path):
        print(f"錯誤: 找不到檔案 {file_path}")
        return

    # 獲取檔案的基本名稱，用於輸出中的 'source' 欄位
    file_name_only = os.path.basename(file_path)

    # output_filename = file_name_only.replace(".pdf", "_structured_output.json")
    output_filename = list(os.path.splitext(file_name_only))
    output_filename[1] = "_structured_output.json"
    output_filename = ''.join(output_filename)
    output_filepath = os.path.join(OUT_DIR, output_filename)
    if os.path.exists(output_filepath) and not FORCE:
        print(f'輸出檔案 {output_filepath} 已存在 - 跳過')
        return

    client = genai.Client()
    uploaded_file = None

    try:
        
        # # 1. 上傳檔案
        # print(f"正在上傳檔案: {file_path}...")
        # uploaded_file = client.files.upload(
        #     file=file_path,
        #     config=dict(
        #         mime_type='application/pdf')
        #     # display_name=file_name_only
        # )
        # print(f"檔案上傳成功。資源名稱: {uploaded_file.name}")
        
        # 2. 構造結構化輸出配置 (使用 Pydantic 的 JSON Schema)
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ExamSet.model_json_schema(), # 使用 Pydantic 生成 Schema
        )

        # 3. 構造 Prompt
        prompt_instruction = (
            f"這是一份包含 50 道考古題的 PDF 文件。請嚴格解析文件內容，將所有題目 (包含選項和正確答案) "
            f"轉換為我指定的 JSON 格式。請確保每個題目的 'number' 欄位是從 1 到 50 的整數，並且 'source' 欄位固定為 '{file_name_only}'。"
            "對於 'subject' 欄位，請根據題目內容判斷是屬於 'process' (製程相關) 還是 'industry' (產業概論相關)。"
            "請務必確保輸出的總題數是 50 題，且答案是 A, B, C, D 之一。"
            "注意版面：每題左側『作答區／答案』欄的字母就是官方答案，若有疑義釋覆或紅字更正，以更正後答案為準；"
            "四個選項必須分別放在 A、B、C、D，選項文字不要包含 (A)(B) 標籤；"
            "題目引用的 1.2.3. 陳述句要放在 question 內；跨頁的題目要完整接起來，不可留空或寫 Missing Option。"
        )

        filepath = pathlib.Path(file_path)
        contents = [
            types.Part.from_bytes(
                data=filepath.read_bytes(),
                mime_type='application/pdf',
            ), # 檔案輸入
            prompt_instruction
        ]

        # 4. 呼叫模型
        print("正在要求模型進行解析與結構化輸出 (這可能需要幾分鐘)...")
        response = client.models.generate_content(
            # flash-lite 抽取錯誤率偏高（見 docs/QA_REPORT.md），預設改用 flash，可用 --model 指定
            model=MODEL,
            contents=contents,
            config=config,
        )
        
        # 5. 解析並驗證 JSON 輸出
        try:
            # 模型回傳的是一個符合 Schema 的 JSON 字串
            raw_json_data = json.loads(response.text)
            
            # 使用 Pydantic 進行最終驗證和資料轉換
            validated_data = ExamSet.model_validate(raw_json_data)
            
            print("\n--- 結構化資料提取成功 ---")
            print(f"共成功解析 {len(validated_data.problems)} 筆資料。")
            
            # 輸出結果 (範例：顯示前兩題)
            print("\n--- 範例輸出 (前兩題) ---")
            for i in range(min(2, len(validated_data.problems))):
                 print(f"題目 {validated_data.problems[i].number}: {validated_data.problems[i].question[:30]}...")
                 print(f"  -> 答案: {validated_data.problems[i].answer}")

            # 將最終驗證的資料寫入新檔案
            with open(output_filepath, 'w', encoding='utf-8') as f:
                f.write(validated_data.model_dump_json(indent=2, ensure_ascii=False))
            
            print(f"\n所有結構化資料已儲存至: {output_filename}")
            return validated_data

        except ValidationError as e:
            print("\n--- Pydantic 驗證失敗 ---")
            print("模型輸出的 JSON 結構與 Pydantic 定義不符。")
            print(e)
        except json.JSONDecodeError:
            print("\n--- JSON 解析失敗 ---")
            print("模型回傳的不是有效的 JSON 字串。")
            print("原始模型輸出:", response.text[:500] + "...")

    except Exception as e:
        print(f"\n發生錯誤: {e}")

    finally:
        # # 6. 清理：刪除上傳的檔案
        # if uploaded_file:
        #     print(f"\n正在刪除臨時檔案: {uploaded_file.name}")
        #     client.files.delete(name=uploaded_file.name)
        #     print("檔案刪除完成。")
        pass


# --- 3. 執行腳本 ---
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="用 Gemini 把考卷 PDF 轉成結構化 JSON")
    ap.add_argument("files", nargs="*", help="要轉換的 PDF（預設：pdfs/ 全部）")
    ap.add_argument("--model", default=MODEL, help=f"Gemini 模型（預設 {MODEL}）")
    ap.add_argument("--force", action="store_true", help="輸出已存在也重新轉換")
    args = ap.parse_args()
    MODEL = args.model
    FORCE = args.force
    os.makedirs(OUT_DIR, exist_ok=True)

    files = args.files or [str(ROOT / 'pdfs' / f) for f in sorted(os.listdir(ROOT / 'pdfs')) if f.lower().endswith('.pdf')]
    for i, path in enumerate(files):
        print(f'Processing {i+1}/{len(files)}: {path}')
        extract_exams_from_pdf(path)
