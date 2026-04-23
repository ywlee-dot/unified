# -*- coding: utf-8 -*-
from typing import Dict, List, Any, Optional
import json
import os
import pandas as pd
from .utils import generate_unique_id, get_current_timestamp

class ResponseCollector:
    """
    설문 응답을 수집하고 저장하며 엑셀로 내보냅니다.
    """
    
    def __init__(self, responses_dir: str):
        self.responses_dir = responses_dir
        os.makedirs(responses_dir, exist_ok=True)

    def save_response(self, survey_id: str, answers: List[Dict[str, Any]]) -> str:
        """
        개별 응답을 JSON 파일로 저장합니다.
        """
        response_id = generate_unique_id("RESP")
        response_data = {
            "response_id": response_id,
            "survey_id": survey_id,
            "submitted_at": get_current_timestamp(),
            "answers": answers
        }
        
        file_path = os.path.join(self.responses_dir, f"{response_id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(response_data, f, ensure_ascii=False, indent=2)
            
        return response_id

    def load_all_responses(self, survey_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        저장된 모든 응답을 불러옵니다. 특정 설문 ID로 필터링 가능합니다.
        """
        responses = []
        if not os.path.exists(self.responses_dir):
            return responses
            
        for filename in os.listdir(self.responses_dir):
            if filename.endswith(".json"):
                path = os.path.join(self.responses_dir, filename)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if survey_id is None or data.get("survey_id") == survey_id:
                            responses.append(data)
                except Exception as e:
                    print(f"경고: 응답 파일 로드 실패 ({filename}): {e}")
                    
        return responses

    def export_to_excel(self, survey_id: str, output_path: str, ordered_questions: List[Dict[str, Any]] = None) -> str:
        """
        특정 설문의 응답을 취합하여 원본(Raw) 엑셀 파일로 저장합니다.
        """
        responses = self.load_all_responses(survey_id)
        if not responses:
            print("정보: 내보낼 응답이 없습니다.")
            return ""
            
        # 1. 컬럼 헤더 매핑 생성
        header_map = {}
        ordered_qids = []
        if ordered_questions:
            for q in ordered_questions:
                qid = q["question_id"]
                qtext = q["question_text"].replace("\n", " ") # 줄바꿈 제거
                sname = q.get("section", "")
                
                # 헤더에 [섹션명] 추가
                if sname:
                    display_text = f"[{sname}] {qid}: {qtext[:30]}..." if len(qtext) > 30 else f"[{sname}] {qid}: {qtext}"
                else:
                    display_text = f"{qid}: {qtext[:30]}..." if len(qtext) > 30 else f"{qid}: {qtext}"
                    
                header_map[qid] = display_text
                ordered_qids.append(qid)
            
        # 2. 데이터 프레임 구성
        flat_data = []
        for resp in responses:
            row = {
                "응답ID": resp["response_id"],
                "제출시간": resp["submitted_at"]
            }
            resp_answers = {item["question_id"]: item["answer"] for item in resp.get("answers", [])}
            
            if ordered_qids:
                for qid in ordered_qids:
                    val = resp_answers.get(qid, "")
                    if isinstance(val, list):
                        val = ", ".join(map(str, val))
                    row[header_map[qid]] = val
            else:
                for qid, val in resp_answers.items():
                    if isinstance(val, list):
                        val = ", ".join(map(str, val))
                    row[qid] = val
            
            flat_data.append(row)
            
        df = pd.DataFrame(flat_data)
        fixed_cols = ["응답ID", "제출시간"]
        other_cols = [c for c in df.columns if c not in fixed_cols]
        df = df[fixed_cols + other_cols]
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_excel(output_path, index=False)
        return output_path

    def export_analysis_report(self, survey_id: str, output_path: str, survey_structure: Dict[str, Any]) -> str:
        """
        응답 데이터를 분석하여 요약 리포트 형식의 엑셀 파일로 저장합니다.
        각 질문별로 별도의 시트를 생성합니다.
        """
        responses = self.load_all_responses(survey_id)
        if not responses:
            return ""

        all_questions = []
        if "sections" in survey_structure:
            for section in survey_structure["sections"]:
                for q in section["questions"]:
                    q_with_section = q.copy()
                    q_with_section["section_name"] = section["section_name"]
                    all_questions.append(q_with_section)
        else:
            all_questions = survey_structure.get("questions", [])

        # 전체 응답에서 각 질문별 답변 수집
        all_answers = {} # qid -> [list of answers]
        for resp in responses:
            for item in resp.get("answers", []):
                qid = item["question_id"]
                ans = item["answer"]
                if qid not in all_answers:
                    all_answers[qid] = []
                
                if isinstance(ans, list):
                    all_answers[qid].extend(ans)
                else:
                    all_answers[qid].append(ans)

        total_resp_count = len(responses)

        # ExcelWriter를 사용하여 여러 시트 저장
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            for q in all_questions:
                qid = q["question_id"]
                qtext = q["question_text"]
                qtype = q["question_type"]
                options = q.get("options", [])
                
                report_rows = []
                # 0. 섹션 정보 추가
                sname = q.get("section_name") or q.get("section", "기본 섹션")
                report_rows.append(["섹션", sname, None])
                
                # 1. 질문 헤더
                report_rows.append(["질문", qtext, None])
                
                # 2. 기본 통계
                q_responses = all_answers.get(qid, [])
                person_resp_count = sum(1 for resp in responses if any(a["question_id"] == qid for a in resp.get("answers", [])))
                
                report_rows.append(["총 답변수", total_resp_count, None])
                report_rows.append(["응답", person_resp_count, None])
                report_rows.append(["무응답", total_resp_count - person_resp_count, None])
                report_rows.append([None, None, None])
                
                # 3. 답변 분포
                if options and isinstance(options, list):
                    report_rows.append(["답변", "답변수", "답변비율"])
                    from collections import Counter
                    counts = Counter(q_responses)
                    for opt in options:
                        count = counts.get(str(opt), 0)
                        # 답변비율 = 답변수 / 총 답변수 (백분율, 소수점 0자리)
                        ratio = (count / total_resp_count * 100) if total_resp_count > 0 else 0
                        report_rows.append([opt, count, f"{int(round(ratio))}%"])
                elif qtype in ["short_text", "long_text", "INPUT_TEXT"]: # INPUT_TEXT 지원 추가
                    report_rows.append(["답변 내용 (샘플)", None, None])
                    for ans in q_responses[:20]: # 샘플 20개까지
                        report_rows.append([ans, None, None])
                
                df_q = pd.DataFrame(report_rows)
                df_q.columns = [qid, "값", "비율"]
                
                # 시트 이름은 QID로 (최대 31자 제한 대응)
                sheet_name = qid[:31]
                df_q.to_excel(writer, sheet_name=sheet_name, index=False)
                
        return output_path
