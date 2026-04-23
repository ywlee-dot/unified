"""Phase 2 메인 파이프라인"""

import argparse
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from loguru import logger

from .config import settings
from .vector_store import VectorStore
from .agents import OrchestratorAgent


def setup_logging():
    """로깅 설정"""
    log_file = settings.paths.logs_dir / f"phase2_{datetime.now():%Y%m%d_%H%M%S}.log"
    settings.paths.logs_dir.mkdir(parents=True, exist_ok=True)

    logger.add(
        log_file,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
        level="DEBUG",
        rotation="10 MB"
    )
    return log_file


def check_prerequisites():
    """사전 요구사항 확인"""
    # 1. API 키 확인
    load_dotenv()
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.error("GOOGLE_API_KEY가 설정되지 않았습니다.")
        print("\n[ERROR] GOOGLE_API_KEY 환경변수가 필요합니다.")
        print("   .env 파일에 다음을 추가하세요:")
        print("   GOOGLE_API_KEY=your_api_key_here")
        return False

    print(f"[OK] Google API 키 확인됨")

    # 2. 벡터 DB 확인
    vector_store = VectorStore()
    stats = vector_store.get_stats()
    total_chunks = sum(stats.values())

    if total_chunks == 0:
        logger.warning("벡터 DB가 비어있습니다. Phase 1을 먼저 실행하세요.")
        print("\n[WARN] 벡터 DB가 비어있습니다.")
        print("   먼저 Phase 1을 실행하세요: python -m src.main")
        return False

    print(f"\n[OK] 벡터 DB 상태: {stats}")
    return True


def run_phase2(skip_on_error: bool = False):
    """Phase 2 실행"""
    log_file = setup_logging()
    print(f"[LOG] 로그 파일: {log_file}")

    if not check_prerequisites():
        return None

    print("\n[START] Phase 2 파이프라인을 시작합니다...")
    print("=" * 60)

    # 오케스트레이터 실행
    orchestrator = OrchestratorAgent()
    result = orchestrator.run_pipeline(skip_on_error=skip_on_error)

    # 결과 저장
    output_path = orchestrator.save_results()
    print(f"\n[SAVED] 결과 저장: {output_path}")

    # 리포트 출력
    if result["status"] == "completed":
        report = orchestrator.generate_report()
        print("\n" + report)

        # 리포트 파일 저장
        report_path = settings.paths.reports_dir / f"phase2_report_{datetime.now():%Y%m%d_%H%M%S}.txt"
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"\n[REPORT] 리포트 저장: {report_path}")
    else:
        print(f"\n[ERROR] 파이프라인 실패: {result['status']}")
        for agent_key, agent_result in result.get("agents", {}).items():
            if agent_result.get("status") != "success":
                print(f"   - {agent_key}: {agent_result.get('error', 'unknown error')}")

    return result


def main():
    """CLI 진입점"""
    parser = argparse.ArgumentParser(
        description="Phase 2: AI Agent 기반 분석 주제 탐색"
    )
    parser.add_argument(
        "--skip-on-error",
        action="store_true",
        help="에이전트 실패 시에도 계속 진행"
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="사전 요구사항만 확인"
    )

    args = parser.parse_args()

    if args.check_only:
        load_dotenv()
        if check_prerequisites():
            print("\n[OK] 모든 사전 요구사항이 충족되었습니다.")
        return

    run_phase2(skip_on_error=args.skip_on_error)


if __name__ == "__main__":
    main()
