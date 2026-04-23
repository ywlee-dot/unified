# -*- coding: utf-8 -*-
from typing import Dict, List, Any, Optional
import pandas as pd
import json
import os
from .utils import replace_placeholders, generate_unique_id, get_current_timestamp

class SurveyBuilder:
    """
    템플릿과 사용자 데이터를 결합하여 실제 설문 설계를 완성합니다.
    """
    
    def __init__(self, template: Dict[str, Any]):
        self.template = template
        self.questions = template.get("questions", [])
        self.logic_rules = template.get("logic_rules", [])
        self.institution_name = ""
        self.data_list = []
        self.survey_metadata = {}

    def set_metadata(self, survey_type: str, institution_name: str, start_date: str, end_date: str):
        """
        설문 기본 정보를 설정합니다.
        """
        self.institution_name = institution_name
        self.survey_metadata = {
            "survey_id": generate_unique_id("SURVEY"),
            "survey_type": survey_type,
            "institution_name": institution_name,
            "start_date": start_date,
            "end_date": end_date,
            "created_at": get_current_timestamp()
        }

    def load_data_list_from_excel(self, excel_path: str, column_name: Optional[str] = None):
        """
        보유 데이터 목록 엑셀 파일에서 데이터명을 로드합니다.
        """
        if not os.path.exists(excel_path):
            print(f"경고: 데이터 목록 파일을 찾을 수 없습니다: {excel_path}")
            return
            
        try:
            df = pd.read_excel(excel_path)
            if column_name and column_name in df.columns:
                self.data_list = df[column_name].dropna().astype(str).tolist()
            else:
                # 컬럼명이 지정되지 않았거나 없으면 첫 번째 컬럼 사용
                self.data_list = df.iloc[:, 0].dropna().astype(str).tolist()
        except Exception as e:
            print(f"에러: 데이터 목록 로드 중 오류 발생: {e}")

    def build(self) -> Dict[str, Any]:
        """
        플레이스홀더를 치환하고 섹션별로 그룹화된 최종 설문 객체를 생성합니다.
        """
        sections_dict = {}
        section_order = []
        
        replacements = {
            "[INSTITUTION_NAME]": self.institution_name
        }
        
        for q in self.questions:
            new_q = q.copy()
            
            # 질문 내용 치환
            new_q["question_text"] = replace_placeholders(new_q["question_text"], replacements)
            
            # [DATA_LIST] 옵션 치환
            if new_q["options"] == "[DATA_LIST]":
                new_q["options"] = self.data_list
                new_q["placeholder_resolved"] = True
            
            # 섹션명 치환 추가
            raw_section_name = new_q.get("section", "기본 섹션")
            section_name = replace_placeholders(raw_section_name, replacements)
            new_q["section"] = section_name # 개별 질문의 섹션 정보도 업데이트
            
            if section_name not in sections_dict:
                sections_dict[section_name] = []
                section_order.append(section_name)
            
            sections_dict[section_name].append(new_q)
            
        # 섹션 형식으로 구성
        structured_sections = []
        all_resolved_questions = []
        for s_name in section_order:
            section_qs = sections_dict[s_name]
            structured_sections.append({
                "section_name": s_name,
                "questions": section_qs
            })
            all_resolved_questions.extend(section_qs)
            
        return {
            "survey_metadata": self.survey_metadata,
            "sections": structured_sections,
            "questions": all_resolved_questions,
            "logic_rules": self.logic_rules
        }

    def save_to_file(self, output_path: str) -> str:
        """
        생성된 설문을 JSON 파일로 저장합니다.
        """
        survey_data = self.build()
        
        # 디렉토리가 없으면 생성
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(survey_data, f, ensure_ascii=False, indent=2)
            
        return output_path
