import pandas as pd
import xlsxwriter
import os
from datetime import datetime
import re
import google.generativeai as genai
import requests
import json
from urllib.parse import quote

class SurveyAdvancedAnalyzer:
    def __init__(self, input_path, api_key=None):
        self.input_path = input_path
        # Setup directories
        self.base_dir = os.path.dirname(os.path.dirname(__file__))
        self.report_dir = os.path.join(self.base_dir, "reports")
        self.chart_img_dir = os.path.join(self.report_dir, "chart_images")
        
        for d in [self.report_dir, self.chart_img_dir]:
            if not os.path.exists(d):
                try: os.makedirs(d)
                except: pass
            
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.findings_path = os.path.join(self.report_dir, f"response_analysis_findings_{timestamp}.xlsx")
        self.charts_path = os.path.join(self.report_dir, f"response_analysis_charts_{timestamp}.xlsx")
            
        self.all_questions = [] 
        self.raw_sheets = [] 
        
        # Initialize Gemini
        api_key = api_key or os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(
                'gemini-2.0-flash',
                generation_config=genai.types.GenerationConfig(
                    temperature=0.75,
                    max_output_tokens=8192,
                    top_p=0.95,
                )
            )
            self.has_ai = True
        else:
            print("Warning: GEMINI_API_KEY not found. Falling back to template-based analysis.")
            self.has_ai = False

    def _call_gemini(self, prompt):
        if not self.has_ai: return None
        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            text = re.sub(r'```json|```|#+\s*|\*\*', '', text, flags=re.MULTILINE)
            text = text.strip()
            return text
        except Exception as e:
            print(f"Gemini API error: {e}")
            return None
        
    def load_data(self):
        print(f"Loading data from {self.input_path}...")
        xl = pd.ExcelFile(self.input_path)
        
        for sn in xl.sheet_names:
            df = pd.read_excel(self.input_path, sheet_name=sn, header=None)
            sheet_meta = {
                'has_table': False,
                'start_row': 0,
                'num_options': 0,
                'q_text': "",
                'q_type': 'subjective',
                'extracted_df': None,
                'section_code': "Z",
                'q_number': "0"
            }
            
            if len(df) >= 3:
                section = str(df.iloc[1, 1]).strip()
                q_text = str(df.iloc[2, 1]).strip().replace('\n', ' ').strip()
                sheet_meta['q_text'] = q_text
                
                # Section Code (e.g., "A", "B", "C")
                sec_match = re.search(r'^([A-Za-z])', section)
                if sec_match: sheet_meta['section_code'] = sec_match.group(1)
                
                # Question Identifier (e.g., Q001, SN_1, etc.)
                q_id_match = re.search(r'([A-Z]*_?\d+)', sn)
                if q_id_match: sheet_meta['q_number'] = q_id_match.group(1)
                else: sheet_meta['q_number'] = sn
                
                found_table = False
                for r in range(5, min(12, len(df))):
                    row_val = str(df.iloc[r, 0])
                    if pd.notna(df.iloc[r, 0]) and any(word in row_val for word in ["답변", "항목", "선택"]):
                        table_data = df.iloc[r+1:].copy()
                        table_data = table_data.iloc[:, :3]
                        table_data.columns = ['Option', 'Count', 'Percentage']
                        table_data = table_data.dropna(subset=['Option', 'Count'])
                        
                        if not table_data.empty:
                            try:
                                # Safe conversion for Percentage
                                def clean_pct(val):
                                    if pd.isna(val): return 0.0
                                    if isinstance(val, str):
                                        return float(val.replace('%', '').strip()) / 100
                                    return float(val)

                                table_data['Percentage'] = table_data['Percentage'].apply(clean_pct)
                                table_data['Count'] = pd.to_numeric(table_data['Count'], errors='coerce').fillna(0)
                                
                                sheet_meta['has_table'] = True
                                sheet_meta['start_row'] = r + 1
                                sheet_meta['num_options'] = len(table_data)
                                sheet_meta['extracted_df'] = table_data
                                sheet_meta['q_type'] = "satisfaction" if "만족" in q_text else "categorical"
                                found_table = True
                                print(f"  > Detected table on sheet {sn}: {len(table_data)} options found.")
                            except Exception as e:
                                print(f"  > Error parsing table on sheet {sn}: {e}")
                        if found_table: break
                
                if not section.startswith('A.'):
                    q_info = {
                        'id': sn,
                        'section': section,
                        'question': q_text,
                        'data': sheet_meta['extracted_df'] if found_table else self._extract_subjective(df, section, q_text),
                        'type': sheet_meta['q_type']
                    }
                    self.all_questions.append(q_info)
            
            self.raw_sheets.append((sn, df, sheet_meta))

    def _extract_subjective(self, df, section, q_text):
        rows = []
        for r in range(5, len(df)):
            val = df.iloc[r, 0]
            if pd.notna(val) and len(str(val).strip()) > 2:
                v_str = str(val).strip()
                if v_str not in [section, q_text, "응답 내용", "응답", "항목"]:
                    rows.append(v_str)
        return rows if rows else None

    def _get_top_options(self, df, n=2):
        sorted_df = df.sort_values(by='Count', ascending=False)
        return sorted_df.head(n).to_dict('records')

    def _analyze_question(self, q_idx):
        q = self.all_questions[q_idx]
        if q['data'] is None or not isinstance(q['data'], pd.DataFrame): 
            return "정성적 응답 데이터로 분류되며, 사용자들의 구체적인 의견을 면밀히 검토하여 키워드 중심의 정리가 필요합니다."
        
        df = q['data']
        sorted_df = df.sort_values(by='Percentage', ascending=False)
        top = sorted_df.iloc[0]
        pct = top['Percentage'] * 100
        option = top['Option']
        q_text = q['question']
        
        # Reference-based heuristics (from survey_analysis_findings.xlsx)
        if "만족" in q_text:
            if pct >= 80: meaning = f"응답자 대다수({pct:.1f}%)가 원활한 이용 경험을 보이고 있으며, 안정적인 품질 관리가 이루어지고 있음을 시사합니다."
            elif pct >= 60: meaning = f"과반 이상의 긍정적 평가가 확인되나, 일부 요소에 대한 질적 개선 여지가 존재함을 보여줍니다."
            else: meaning = f"만족도가 상대적으로 낮게 형성되어 있어, 구조적 품질 향상과 근본적인 개선 조치가 시급한 지점입니다."
        elif "이유" in q_text or "원인" in q_text:
            meaning = f"해당 항목이 데이터 활용 환경의 실질적인 허들로 작용하고 있으며, 이를 해소하기 위한 정책적·기술적 지원이 요구됩니다."
        elif "목적" in q_text:
            meaning = f"사용자들이 주로 '{option}' 등을 목적으로 데이터를 활용하고 있어, 해당 용도에 최적화된 데이터 제공 체계 구축이 필요합니다."
        else:
            meaning = f"'{option}'에 대한 응답 비중({pct:.1f}%)이 가장 높게 나타났으며, 이는 현장의 보편적인 요구사항과 현황을 명확히 반영하는 지표입니다."

        return f"- {q_text} 분석 결과 응답자의 {pct:.1f}%가 '{option}'이라 답하였으며, 이는 {meaning}"

    def _generate_fallback_section_analysis(self, sec_name, qs):
        """Generates structured section analysis with What/Why/How format using all findings."""
        findings = []
        for q in qs:
            if isinstance(q['data'], pd.DataFrame) and not q['data'].empty:
                sorted_df = q['data'].sort_values(by='Percentage', ascending=False)
                top = sorted_df.iloc[0]
                second = sorted_df.iloc[1] if len(sorted_df) > 1 else None
                lowest = sorted_df.iloc[-1] if len(sorted_df) > 1 else None
                findings.append({
                    'q': q['question'],
                    'opt': top['Option'], 'pct': top['Percentage'] * 100,
                    'second_opt': second['Option'] if second is not None else None,
                    'second_pct': second['Percentage'] * 100 if second is not None else 0,
                    'lowest_opt': lowest['Option'] if lowest is not None else None,
                    'lowest_pct': lowest['Percentage'] * 100 if lowest is not None else 0,
                    'is_satisfaction': '만족' in q['question']
                })

        if not findings:
            return {"section_summary": "- 해당 부문의 정량 데이터가 부족하여 정성적 검토가 필요함.", "section_insights": "정량 분석 대상 데이터 부재로 정성적 검토 필요", "section_tasks": []}

        # Cross-question satisfaction gap analysis
        sat_findings = [f for f in findings if f['is_satisfaction']]
        non_sat_findings = [f for f in findings if not f['is_satisfaction']]

        # Summary with cross-question comparison
        summary_parts = []
        summary_parts.append(f"- {sec_name} 부문 분석 결과, '{findings[0]['q']}'에서 '{findings[0]['opt']}'이 {findings[0]['pct']:.1f}%로 최다 응답을 기록함.")
        if len(findings) > 1:
            gap = abs(findings[0]['pct'] - findings[1]['pct'])
            summary_parts.append(f"- '{findings[1]['q']}'의 최다 응답 '{findings[1]['opt']}'({findings[1]['pct']:.1f}%)와 비교 시 {gap:.1f}%p의 격차가 확인되며, 이는 부문 내 우선순위 차별화의 근거로 활용 가능함.")
        if sat_findings and non_sat_findings:
            summary_parts.append(f"- 특히 만족도 항목({sat_findings[0]['q']})에서 최다 응답 비율({sat_findings[0]['pct']:.1f}%)과 실제 이용 현황 간 교차 검토가 필요한 것으로 판단됨.")
        summary = "\n".join(summary_parts)

        # Insights & Tasks with What/Why/How for ALL findings
        insights = []
        tasks = []
        for i, f in enumerate(findings):
            # What/Why/How structured insight
            what_part = f"[What] '{f['q']}' 항목에서 '{f['opt']}'이 {f['pct']:.1f}%로 최다 응답을 차지함"
            if f['lowest_opt']:
                what_part += f"(최하위: '{f['lowest_opt']}' {f['lowest_pct']:.1f}%, 격차 {f['pct'] - f['lowest_pct']:.1f}%p)"

            why_part = f"[Why] "
            if f['is_satisfaction']:
                if f['pct'] >= 70:
                    why_part += f"높은 긍정 응답률은 해당 영역의 서비스 기반이 안정적임을 시사하나, 나머지 {100 - f['pct']:.1f}%의 미충족 수요에 대한 원인 규명이 필요함"
                else:
                    why_part += f"긍정 응답률이 {f['pct']:.1f}%에 머물러, 응답자 {100 - f['pct']:.1f}%의 불만족 요인에 대한 심층 진단이 시급함"
            else:
                why_part += f"'{f['opt']}' 집중 현상({f['pct']:.1f}%)은 이용자들의 핵심 수요가 해당 영역에 편중되어 있음을 반영함"
                if f['second_opt']:
                    why_part += f". 차순위 '{f['second_opt']}'({f['second_pct']:.1f}%)와의 {f['pct'] - f['second_pct']:.1f}%p 격차는 자원 배분 우선순위의 판단 근거가 됨"

            how_part = f"[How] "
            if f['is_satisfaction']:
                how_part += f"만족도 하위 응답 그룹 대상 심층 인터뷰 및 불만족 요인 세분화 분석을 통해 맞춤형 개선 방안 도출 필요"
            else:
                how_part += f"'{f['opt']}' 수요 충족을 위한 전용 서비스 체계 구축 및 차순위 항목 대상 단계적 확대 방안 마련 필요"

            insights.append(f"{i+1}. {what_part}. {why_part}. {how_part}.")

            # Specific task with 3-stage implementation
            opt_label = f['opt']
            q_short = f['q'][:15]
            if f['is_satisfaction']:
                task_name = f"{q_short} 만족도 제고를 위한 품질 개선 체계 구축"
                stage2_focus = "만족도 개선 프로그램"
                stage2_target = "목표: 만족도 " + str(min(int(f['pct'] + 10), 95)) + "% 이상 달성"
                stage3_metric = "만족도"
                stage1_group = "하위 불만족 그룹"
            else:
                task_name = f"'{opt_label}' 수요 대응 및 {q_short} 개선 체계 구축"
                stage2_focus = f"'{opt_label}' 중심 서비스 강화 방안"
                stage2_target = "이용자 접근성 및 편의성 향상 목표 설정"
                stage3_metric = "이용률"
                stage1_group = "비선택 그룹"
            task_detail = (
                f"[1단계: 진단] '{f['q']}' 응답 데이터 심층 분석 — '{opt_label}'({f['pct']:.1f}%) 선택 이유 및 "
                f"{stage1_group}의 니즈 파악 → "
                f"[2단계: 설계] 분석 결과 기반 {stage2_focus} 수립, {stage2_target} → "
                f"[3단계: 검증] 파일럿 운영 후 {stage3_metric} 변화 추적 및 피드백 반영 체계 운영"
            )
            tasks.append({"task_name": task_name, "task_detail": task_detail})

        individual_analysis = [{"index": i, "analysis": insight} for i, insight in enumerate(insights)]
        return {"individual_analysis": individual_analysis, "section_summary": summary, "section_insights": "\n".join(insights), "section_tasks": tasks}

    def _synthesize_cross_section(self, all_summaries):
        """Makes a dedicated Gemini call to synthesize cross-section insights from all per-section results."""
        if not self.has_ai or not all_summaries:
            return None

        # Build context from all sections
        section_context_parts = []
        for sec_name, data in all_summaries.items():
            section_context_parts.append(
                f"[부문: {sec_name}]\n"
                f"종합 분석: {data['summary']}\n"
                f"시사점: {data['insights']}\n"
                f"과제: {json.dumps(data['tasks'], ensure_ascii=False)}"
            )

        prompt = (
            "당신은 공공데이터 개방 전략 전문 컨설턴트입니다. 아래는 설문조사의 각 부문별 분석 결과입니다.\n"
            "이제 모든 부문을 교차 종합하여, 부문 간 공통 패턴, 상호 의존성, 우선순위를 도출하세요.\n\n"
            "[절대 금지]\n"
            "- 각 부문 분석을 단순 반복하거나 나열하지 마세요.\n"
            "- '프로세스 개선', '강화 추진', '고도화 필요' 등 구체성 없는 표현 금지.\n"
            "- 반드시 2개 이상의 부문을 교차 비교하는 내용을 포함하세요.\n\n"
            "[필수 분석 원칙]\n"
            "1. 부문 간 교차 패턴: 여러 부문에서 반복적으로 나타나는 공통 이슈를 식별하세요.\n"
            "2. 부문 간 상호 의존성: A 부문의 문제가 B 부문에 영향을 미치는 인과 관계를 분석하세요.\n"
            "3. 우선순위 판단: 시급성(영향 범위 × 심각도)을 기준으로 과제의 우선순위를 매기세요.\n"
            "4. 모든 시사점은 What(현상)/Why(원인)/How(대응) 구조로, 구체적 수치를 인용하여 작성하세요.\n"
            "5. 개선과제는 [1단계: 진단] → [2단계: 설계/구축] → [3단계: 검증/확산]의 3단계 구조를 따르세요.\n\n"
            "[우수 교차 분석 예시]\n"
            "시사점 예시: \"1. [What] 데이터 접근성(B부문)에서 '복잡한 절차'가 44.7%로 최다 장애 요인인 동시에, "
            "활용 만족도(C부문)에서도 '이용 편의성' 불만이 38.2%로 나타나 두 부문 간 강한 연관성이 확인됨. "
            "[Why] 접근 단계의 복잡성이 활용 단계의 만족도까지 연쇄적으로 저하시키는 구조적 문제로, "
            "단순히 만족도 개선만으로는 근본 해결이 불가함. "
            "[How] 접근성 개선(원클릭 다운로드)을 선행 조치로 추진한 후, 만족도 변화를 6개월간 추적하여 "
            "연쇄 효과를 검증하는 단계적 접근이 필요함.\"\n\n"
            "다음 JSON 형식을 정확히 따르세요:\n"
            "{\n"
            "  \"cross_section_insights\": [\n"
            "    {\n"
            "      \"section\": \"교차 분석 대상 부문명 (예: B. 데이터 접근성 × C. 활용 만족도)\",\n"
            "      \"insight\": \"[What/Why/How] 교차 분석 시사점 — 반드시 2개 이상 부문의 수치를 교차 인용\"\n"
            "    }\n"
            "  ],\n"
            "  \"cross_section_tasks\": [\n"
            "    {\n"
            "      \"section\": \"관련 부문명\",\n"
            "      \"task_name\": \"교차 분석에서 도출된 구체적 과제명(20자 이상)\",\n"
            "      \"task_detail\": \"[1단계: 진단] → [2단계: 설계/구축] → [3단계: 검증/확산] 각 단계별 실행 내용과 목표 수치\",\n"
            "      \"priority\": \"상/중/하\"\n"
            "    }\n"
            "  ]\n"
            "}\n\n"
            "[각 부문별 분석 결과]\n"
            + "\n\n".join(section_context_parts)
        )

        print("  > AI 교차 부문 종합 분석 수행 중...")
        ai_response = self._call_gemini(prompt)
        try:
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                print("  > 교차 부문 종합 분석 완료.")
                return result
        except Exception as e:
            print(f"  > 교차 부문 종합 분석 실패 ({e}) — 부문별 결과로 대체합니다.")
        return None

    def _generate_quickchart_image(self, labels, data, chart_type, title, filename):
        """Generates a high-quality standard bar chart image using QuickChart.io API."""
        colors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69']
        
        # Custom formatter for datalabels: show as %
        chart_config = {
            'type': 'bar',
            'data': {
                'labels': labels,
                'datasets': [{
                    'label': '비중(%)',
                    'data': data,
                    'backgroundColor': colors[0],
                    'borderWidth': 1
                }]
            },
            'options': {
                'title': {'display': False},
                'legend': {'display': False},
                'layout': {'padding': {'top': 25}},
                'scales': {
                    'yAxes': [{
                        'ticks': {
                            'beginAtZero': True,
                            'fontSize': 11,
                            'max': max(data) + 10 if data else 100
                        }
                    }],
                    'xAxes': [{'ticks': {'fontSize': 11}}]
                },
                'plugins': {
                    'datalabels': {
                        'display': True,
                        'anchor': 'end',
                        'align': 'top',
                        'color': '#444',
                        'font': {'weight': 'bold', 'size': 11},
                        'formatter': '(value) => value + "%"'
                    }
                }
            }
        }
        
        short_config = json.dumps(chart_config)
        api_url = f"https://quickchart.io/chart?width=600&height=300&c={quote(short_config)}"
        print(f"  > Requesting chart for: {filename}")
        
        import time
        for attempt in range(3):
            try:
                response = requests.get(api_url, timeout=15)
                if response.status_code == 200:
                    clean_filename = re.sub(r'[\\/*?:"<>|]', '', filename)
                    filepath = os.path.join(self.chart_img_dir, f"{clean_filename}.png")
                    with open(filepath, 'wb') as f:
                        f.write(response.content)
                    return filepath
            except Exception as e:
                print(f"QuickChart API error for {filename} (attempt {attempt + 1}/3): {e}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
        return None

    def generate_integrated_report(self):
        print(f"Generating integrated report: {self.findings_path}...")
        workbook = xlsxwriter.Workbook(self.findings_path)
        
        # Formats
        header_fmt = workbook.add_format({'bold': True, 'bg_color': '#D9E1F2', 'border': 1, 'align': 'center', 'valign': 'vcenter'})
        cell_fmt = workbook.add_format({'border': 1, 'valign': 'top', 'text_wrap': True})
        q_title_fmt = workbook.add_format({'bold': True, 'font_size': 11, 'bg_color': '#F2F2F2', 'border': 1})
        insight_fmt = workbook.add_format({'valign': 'top', 'text_wrap': True, 'font_size': 10, 'border': 1})
        section_title_fmt = workbook.add_format({'bold': True, 'font_size': 14, 'bg_color': '#D9E1F2', 'border': 1, 'align': 'left'})
        summary_cell_fmt = workbook.add_format({'border': 1, 'valign': 'top', 'text_wrap': True, 'bg_color': '#F8F9FA', 'italic': True, 'font_color': '#1F4E78'})
        
        sections = {}
        for q in self.all_questions:
            if q['section'] not in sections: sections[q['section']] = []
            sections[q['section']].append(q)
            
        all_summaries = {}
        
        for sec_name, qs in sorted(sections.items()):
            sheet_name = re.sub(r'[:*?/\\\[\]]', '_', sec_name[:31])
            sheet = workbook.add_worksheet(sheet_name)
            sheet.set_column('A:B', 60) # Main area
            
            # Header
            sheet.merge_range(0, 0, 0, 1, f"○ {sec_name}", section_title_fmt)
            
            row_idx = 2
            section_context = []
            
            if self.has_ai:
                for i, q in enumerate(qs):
                    q_data = ""
                    if isinstance(q['data'], pd.DataFrame):
                        temp_df = q['data'].copy()
                        temp_df['Percentage'] = (temp_df['Percentage'] * 100).round(1).astype(str) + "%"
                        q_data = f"[데이터]\n{temp_df.to_string(index=False)}"
                    section_context.append(f"Q_INDEX_{i}: {q['question']}\n{q_data}")
                
                prompt = (
                    f"당신은 공공데이터 개방 전략 전문 컨설턴트입니다. 섹션 '{sec_name}'의 설문 데이터를 분석하여 전문 보고서를 작성하세요.\n\n"
                    f"[절대 금지 - 아래와 같은 피상적 분석은 0점 처리됨]\n"
                    f"- BAD: '프로세스 개선이 필요함' (구체성 없음)\n"
                    f"- BAD: '서비스 강화 추진이 요구됨' (어떤 서비스? 어떻게 강화?)\n"
                    f"- BAD: '만족도가 높게 나타남' (몇 %? 다른 항목과 비교하면?)\n"
                    f"- BAD: '개선이 시급함' (무엇을? 왜 시급?)\n"
                    f"금지 표현: '프로세스 개선', '강화 추진', '고도화 필요', '체계 구축', '개선 실시' — 이런 빈 표현 대신 구체적 수치와 맥락을 사용하세요.\n\n"
                    f"[필수 분석 원칙]\n"
                    f"1. 모든 주장에는 반드시 구체적 응답 비율(%)을 인용하세요.\n"
                    f"2. 문항 간 교차 비교를 수행하세요 — 예: 'Q1에서 A가 70%인 반면, Q3에서 관련 만족도는 45%에 그쳐 실제 체감과 기대 사이 25%p 격차가 존재함'\n"
                    f"3. 각 시사점은 What(현상)/Why(원인 추론)/How(대응 방향)의 3단 구조로 서술하세요.\n"
                    f"4. 개별 분석은 최소 3~5문장, 종합 분석은 최소 2~3문단으로 작성하세요.\n\n"
                    f"[우수 분석 예시]\n"
                    f"individual_analysis 예시:\n"
                    f"\"[What] 데이터 품질 만족도에서 '보통' 이하 응답이 42.3%로 나타나, 약 10명 중 4명은 현재 데이터 품질에 불만족하는 것으로 확인됨. "
                    f"[Why] 이는 Q2의 '데이터 최신성 부족'(38.1%)과 Q4의 '메타데이터 미비'(29.4%)가 복합적으로 작용한 결과로 추론됨. "
                    f"특히 최신성 부족과 품질 불만족 간 상관관계가 높아, 데이터 갱신 주기가 체감 품질을 좌우하는 핵심 변수임을 시사함. "
                    f"[How] 월 1회 이상 갱신 체계 도입과 품질 메트릭 공개를 통해 이용자 신뢰 기반을 확보할 필요가 있음.\"\n\n"
                    f"section_insights 예시:\n"
                    f"\"1. [What] 전체 응답자의 67.2%가 데이터 활용 경험이 있으나, 재이용 의향은 51.8%로 15.4%p 하락함. "
                    f"[Why] Q3 '이용 장애 요인'에서 '복잡한 접근 절차'(44.7%)와 '포맷 비호환'(31.2%)이 주요 이탈 원인으로 지목됨. "
                    f"[How] 원클릭 다운로드 및 표준 포맷(CSV/JSON) 자동 변환 기능 도입으로 재이용률 70% 이상 달성을 목표로 설정해야 함.\"\n\n"
                    f"section_tasks 예시:\n"
                    f"{{\"task_name\": \"데이터 접근성 개선을 위한 원클릭 다운로드 체계 구축\", "
                    f"\"task_detail\": \"[1단계: 진단] 현재 평균 다운로드 소요 단계(4.2단계) 및 이탈률(23.5%) 정량 분석 → "
                    f"[2단계: 설계] API 기반 원클릭 다운로드 모듈 개발, CSV/JSON/XML 자동 변환 파이프라인 구축 → "
                    f"[3단계: 검증] 파일럿 운영 후 이용자 재이용률 및 만족도 변화 추적(목표: 재이용률 15%p 이상 개선)\"}}\n\n"
                    f"[어투] 공적 보고서 언어 사용 (예: '~로 분석됨', '~한 양상임', '~가 요구됨')\n\n"
                    f"다음 JSON 형식을 정확히 따르세요:\n"
                    f"{{\n"
                    f"  \"individual_analysis\": [\n"
                    f"    {{\"index\": 0, \"analysis\": \"[What] 현상 서술(수치 포함) [Why] 원인 분석(교차 비교) [How] 대응 방향 — 최소 3~5문장\"}}\n"
                    f"  ],\n"
                    f"  \"section_summary\": \"부문 전체의 교차 분석 결과를 2~3문단으로 종합. 문항 간 수치 비교, 핵심 격차, 우선 대응 영역 명시.\",\n"
                    f"  \"section_insights\": \"1. [What/Why/How] 첫 번째 시사점(수치 근거 필수)\\n2. [What/Why/How] 두 번째 시사점...\",\n"
                    f"  \"section_tasks\": [\n"
                    f"    {{\"task_name\": \"시사점 1에 대응하는 구체적 과제명(20자 이상)\", \"task_detail\": \"[1단계] 진단 → [2단계] 설계/구축 → [3단계] 검증/확산 — 각 단계별 구체적 실행 내용과 목표 수치 포함\"}}\n"
                    f"  ]\n"
                    f"}}\n\n"
                    f"[분석 대상 데이터 — 문항 간 교차 비교를 반드시 수행하세요]\n"
                    + "\n\n".join(section_context)
                )
                
                print(f"  > AI 분석 수행 중 (섹션: {sec_name})...")
                ai_response = self._call_gemini(prompt)
                try:
                    import json
                    json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
                    if json_match:
                        section_analysis_results = json.loads(json_match.group())
                        print(f"  > AI 분석 완료.")
                    else:
                        print(f"  > AI 응답 형식 오류 - 데이터 기반 템플릿으로 전환.")
                        section_analysis_results = self._generate_fallback_section_analysis(sec_name, qs)
                except Exception as e:
                    print(f"  > AI 분석 실패 ({e}) - 데이터 기반 템플릿으로 전환.")
                    section_analysis_results = self._generate_fallback_section_analysis(sec_name, qs)
            else:
                print(f"  > Gemini API 비활성 - 데이터 기반 템플릿 분석 수행.")
                section_analysis_results = self._generate_fallback_section_analysis(sec_name, qs)

            ai_indices = {item['index']: item['analysis'] for item in section_analysis_results.get('individual_analysis', []) if 'index' in item}
            
            chart_count = 1
            for i, q in enumerate(qs):
                # 1. Question Title
                sheet.merge_range(row_idx, 0, row_idx, 1, f"  - {q['question']}", q_title_fmt)
                row_idx += 1
                
                # 2. Insights (Text)
                analysis_text = ai_indices.get(i, self._analyze_question(self.all_questions.index(q)))
                if not analysis_text: analysis_text = "상세 분석 내용이 존재하지 않습니다."
                
                sheet.merge_range(row_idx, 0, row_idx, 1, f"§ {analysis_text}", insight_fmt)
                sheet.set_row(row_idx, 60) # Adjust for text length
                row_idx += 1
                
                # 3. Chart (Image) - Vertical stack
                if isinstance(q['data'], pd.DataFrame):
                    labels = q['data']['Option'].tolist()
                    # Use Percentage (converted to 0-100) for bar labels
                    percentages = (q['data']['Percentage'] * 100).round(1).tolist()
                    
                    # Filename: SectionName_QuestionNumber
                    clean_sec_name = re.sub(r'[:*?/\\\[\]\s]', '_', sec_name)
                    q_filename = f"{clean_sec_name}_{i+1}"
                    
                    print(f"  > Processing Chart {i+1} for section {sec_name}")
                    img_path = self._generate_quickchart_image(labels, percentages, 'bar', "", q_filename)
                    
                    if img_path:
                        sheet.insert_image(row_idx, 0, img_path, {'x_scale': 0.75, 'y_scale': 0.75, 'x_offset': 10, 'y_offset': 5})
                        sheet.write(row_idx + 8, 0, f"[그림 {chart_count}] {q['question'][:40]} 응답 결과(%)", workbook.add_format({'align': 'center', 'font_size': 9, 'italic': True}))
                        sheet.set_row(row_idx, 200) # Ensure space for the image
                        row_idx += 10 # Jump past the chart image
                        chart_count += 1
                    else:
                        print(f"  > Failed to generate chart for {q_filename}")
                
                row_idx += 1 # White space between questions

            # Section Summary
            summary_title = f"□ {sec_name} 부문 종합 분석 결과"
            summary_text = section_analysis_results.get('section_summary', "- 해당 부문에서 확인된 데이터의 유의미한 경향 추적 중.")
            sheet.merge_range(row_idx, 0, row_idx, 1, summary_title, header_fmt)
            row_idx += 1
            sheet.merge_range(row_idx, 0, row_idx, 1, summary_text, summary_cell_fmt)
            sheet.set_row(row_idx, 80)
            
            all_summaries[sec_name] = {
                'summary': summary_text, 
                'insights': section_analysis_results.get('section_insights', summary_text),
                'tasks': section_analysis_results.get('section_tasks', [])
            }

        # Cross-section synthesis via dedicated Gemini call
        cross_synthesis = self._synthesize_cross_section(all_summaries)

        # 2. Strategic Insights (시사점 종합)
        sum_sheet = workbook.add_worksheet("시사점 종합")
        sum_sheet.set_column('A:A', 35); sum_sheet.set_column('B:B', 120)
        sum_sheet.write(0, 0, "부문", header_fmt); sum_sheet.write(0, 1, "현상 분석 및 전략적 대응(What/Why/How)", header_fmt)
        r = 1

        if cross_synthesis and 'cross_section_insights' in cross_synthesis:
            # Use cross-section synthesized insights
            for item in cross_synthesis['cross_section_insights']:
                sum_sheet.write(r, 0, f"○ {item.get('section', '')}", cell_fmt)
                sum_sheet.write(r, 1, item.get('insight', ''), cell_fmt)
                # Dynamic row height based on content length
                content_len = len(item.get('insight', ''))
                row_height = max(60, min(200, content_len // 2))
                sum_sheet.set_row(r, row_height)
                r += 1
        else:
            # Fallback: per-section insights (no regression)
            for sec, data in all_summaries.items():
                sum_sheet.write(r, 0, f"○ {sec}", cell_fmt)
                sum_sheet.write(r, 1, data['insights'], cell_fmt)
                content_len = len(data['insights'])
                row_height = max(60, min(200, content_len // 2))
                sum_sheet.set_row(r, row_height)
                r += 1

        # 3. Improvement Tasks (개선과제)
        task_sheet = workbook.add_worksheet("개선과제")
        task_sheet.set_column('A:A', 30); task_sheet.set_column('B:B', 30); task_sheet.set_column('C:C', 100)
        task_sheet.write(0, 0, "부문", header_fmt); task_sheet.write(0, 1, "개선 과제 명", header_fmt); task_sheet.write(0, 2, "세부 추진전략 및 실행방안", header_fmt)
        r = 1

        if cross_synthesis and 'cross_section_tasks' in cross_synthesis:
            # Use cross-section synthesized tasks, sorted by priority
            priority_order = {'상': 0, '중': 1, '하': 2}
            sorted_tasks = sorted(
                cross_synthesis['cross_section_tasks'],
                key=lambda t: priority_order.get(t.get('priority', '중'), 1)
            )
            for t in sorted_tasks:
                task_sheet.write(r, 0, t.get('section', ''), cell_fmt)
                priority_prefix = f"[{t.get('priority', '중')}] " if t.get('priority') else ""
                task_sheet.write(r, 1, f"{priority_prefix}{t.get('task_name', '')}", cell_fmt)
                task_sheet.write(r, 2, t.get('task_detail', ''), cell_fmt)
                content_len = len(t.get('task_detail', ''))
                row_height = max(40, min(150, content_len // 2))
                task_sheet.set_row(r, row_height)
                r += 1
        else:
            # Fallback: per-section tasks (no regression)
            for sec, data in all_summaries.items():
                for t in data.get('tasks', []):
                    task_sheet.write(r, 0, sec, cell_fmt)
                    task_sheet.write(r, 1, t.get('task_name', ''), cell_fmt)
                    task_sheet.write(r, 2, t.get('task_detail', ''), cell_fmt)
                    content_len = len(t.get('task_detail', ''))
                    row_height = max(40, min(150, content_len // 2))
                    task_sheet.set_row(r, row_height)
                    r += 1
        
        workbook.close()
        print(f"Integrated report generated: {self.findings_path}")

    def run(self):
        self.load_data()
        self.generate_integrated_report()

if __name__ == "__main__":
    api_key = os.getenv("GEMINI_API_KEY")
    base_dir = os.path.dirname(os.path.dirname(__file__))
    input_file = os.path.join(base_dir, 'data', 'input_sample.xlsx')
    if os.path.exists(input_file):
        analyzer = SurveyAdvancedAnalyzer(input_file, api_key=api_key)
        analyzer.run()
    else:
        print(f"Input file not found at {input_file}")
