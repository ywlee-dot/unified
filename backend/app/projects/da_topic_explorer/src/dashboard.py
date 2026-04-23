"""웹 대시보드 - 분석 주제 탐색 결과 시각화 및 파이프라인 제어"""

import json
import os
from datetime import datetime
from pathlib import Path
from werkzeug.utils import secure_filename

from flask import Flask, render_template, request, jsonify

from src.config import settings
from src.main import Phase1Pipeline
from src.agents.orchestrator import OrchestratorAgent
from src.agents.plan_generator import PlanGeneratorAgent

# 템플릿 폴더 지정
template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
app = Flask(__name__, template_folder=template_dir)

import threading
import uuid

# 글로벌 태스크 상태 관리
global_tasks = {}

def get_latest_result_path():
    """가장 최근 결과 파일 경로 로드"""
    reports_dir = settings.paths.reports_dir
    if not reports_dir.exists():
        return None
    result_files = list(reports_dir.glob("phase2_result_*.json"))
    if not result_files:
        return None
    latest_file = max(result_files, key=lambda x: x.stat().st_mtime)
    return latest_file

def load_result(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

@app.route("/")
def dashboard():
    """메인 대시보드 UI"""
    return render_template('index.html')

@app.route("/api/latest_result")
def api_latest_result():
    path = get_latest_result_path()
    if path:
        try:
            data = load_result(path)
            data['context']['file_path'] = str(path)
            return jsonify(data)
        except Exception as e:
            return jsonify({"status": "error", "error": str(e)})
    return jsonify({"context": None})

@app.route("/api/upload_multiple", methods=["POST"])
def api_upload_multiple():
    """여러 기관 동시 파일 업로드 엔드포인트"""
    inst_names = request.form.getlist("instName[]")
    
    if not inst_names:
        return jsonify({"status": "error", "error": "기관명이 하나 이상 필요합니다."}), 400

    uploaded_count = 0
    for idx, institution in enumerate(inst_names):
        institution = institution.strip()
        if not institution:
            continue

        # 저장 경로 확보
        inst_dir = settings.paths.institutions_dir / institution
        inst_dir.mkdir(parents=True, exist_ok=True)
        catalog_dir = settings.paths.data_catalog_dir
        catalog_dir.mkdir(parents=True, exist_ok=True)

        # 프로파일 저장
        profiles = request.files.getlist(f"profileFiles_{idx}[]")
        for fw in profiles:
            if fw and fw.filename:
                fw.save(inst_dir / secure_filename(fw.filename))
        
        # 메타데이터 저장
        catalog = request.files.get(f"catalogFile_{idx}")
        if catalog and catalog.filename:
            ext = os.path.splitext(catalog.filename)[1]
            catalog.save(catalog_dir / f"{institution}_메타데이터{ext}")
            
        uploaded_count += 1

    return jsonify({"status": "success", "message": f"총 {uploaded_count}건의 기관 자료가 업로드 요청되었습니다."})


def run_pipeline_task(task_id):
    """백그라운드 파이프라인 실행 태스크"""
    try:
        global_tasks[task_id]["status"] = "running"
        global_tasks[task_id]["message"] = "Phase 1: 데이터 로딩 및 인덱싱 중..."
        
        # Phase 1
        p1 = Phase1Pipeline(rebuild=False)
        p1.run()

        global_tasks[task_id]["message"] = "Phase 2: AI 에이전트 파이프라인 시작..."
        # Phase 2
        p2 = OrchestratorAgent()
        
        # Orchestrator의 로그를 task status에 연결 (간이 방식)
        original_log_step = p2._log_step
        def custom_log_step(agent_name, status, message=""):
            original_log_step(agent_name, status, message)
            global_tasks[task_id]["message"] = f"{agent_name}: {status} {message}"
        
        p2._log_step = custom_log_step
        
        result = p2.run_pipeline()
        output_path = p2.save_results()

        global_tasks[task_id]["status"] = "completed"
        global_tasks[task_id]["result"] = {
            "status": result["status"],
            "context": p2.context
        }
        global_tasks[task_id]["message"] = "모든 분석이 완료되었습니다."
        
    except Exception as e:
        global_tasks[task_id]["status"] = "error"
        global_tasks[task_id]["error"] = str(e)
        global_tasks[task_id]["message"] = f"오류 발생: {str(e)}"

@app.route("/api/run_pipeline", methods=["POST"])
def api_run_pipeline():
    """Phase 1 과 Phase 2 비동기 실행 시작"""
    task_id = str(uuid.uuid4())
    global_tasks[task_id] = {
        "status": "pending",
        "message": "작업 대기 중...",
        "start_time": datetime.now().isoformat()
    }
    
    thread = threading.Thread(target=run_pipeline_task, args=(task_id,))
    thread.daemon = True
    thread.start()
    
    return jsonify({"status": "accepted", "task_id": task_id})


def generate_plans_task(task_id, selected_topic_ids, context_path):
    """백그라운드 계획서 생성 태스크"""
    try:
        global_tasks[task_id]["status"] = "running"
        global_tasks[task_id]["message"] = "계획서 기반 데이터 로드 중..."
        
        context_data = load_result(context_path).get("context", {})
        topics = context_data.get("topic_discoverer", {}).get("topics", [])
        filtered_topics = [t for t in topics if t.get("id") in selected_topic_ids]
        context_data["topic_discoverer"]["topics"] = filtered_topics

        global_tasks[task_id]["message"] = f"{len(filtered_topics)}개의 주제에 대해 AI 분석 계획서 생성 중..."
        
        agent = PlanGeneratorAgent(vector_store=None)
        result = agent.run(context_data)
        
        if result.success:
            global_tasks[task_id]["status"] = "completed"
            global_tasks[task_id]["result"] = {"status": "success", "plans": result.data.get("plans", [])}
            global_tasks[task_id]["message"] = "계획서 생성이 완료되었습니다."
        else:
            global_tasks[task_id]["status"] = "error"
            global_tasks[task_id]["error"] = result.error
            global_tasks[task_id]["message"] = f"생성 실패: {result.error}"

    except Exception as e:
        global_tasks[task_id]["status"] = "error"
        global_tasks[task_id]["error"] = str(e)
        global_tasks[task_id]["message"] = f"오류 발생: {str(e)}"

@app.route("/api/generate_plans", methods=["POST"])
def api_generate_plans():
    """선택된 주제에 대해 PlanGeneratorAgent 비동기 실행 시작"""
    data = request.json
    selected_topic_ids = data.get("selected_topic_ids", [])
    context_path = data.get("context_path")

    if not context_path or not os.path.exists(context_path):
        return jsonify({"status": "error", "error": "결과 파일을 찾을 수 없습니다."}), 400

    if not selected_topic_ids:
        return jsonify({"status": "error", "error": "선택된 주제가 없습니다."}), 400

    task_id = str(uuid.uuid4())
    global_tasks[task_id] = {
        "status": "pending",
        "message": "계획서 생성 대기 중...",
        "start_time": datetime.now().isoformat()
    }
    
    thread = threading.Thread(target=generate_plans_task, args=(task_id, selected_topic_ids, context_path))
    thread.daemon = True
    thread.start()
    
    return jsonify({"status": "accepted", "task_id": task_id})


@app.route("/api/task_status/<task_id>")
def api_task_status(task_id):
    """태스크 진행 상태 조회"""
    task = global_tasks.get(task_id)
    if not task:
        return jsonify({"status": "not_found"}), 404
    return jsonify(task)


def run_dashboard(host="127.0.0.1", port=5000, debug=False):
    app.run(host=host, port=port, debug=debug)

if __name__ == "__main__":
    run_dashboard(debug=True)


def run_dashboard(host="127.0.0.1", port=5000, debug=False):
    app.run(host=host, port=port, debug=debug)

if __name__ == "__main__":
    run_dashboard(debug=True)
