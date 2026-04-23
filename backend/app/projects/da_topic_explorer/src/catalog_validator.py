# -*- coding: utf-8 -*-
"""
카탈로그 교차 검증기 — Agent 2 결과의 테이블명을 catalog_index.json과 코드 레벨로 검증.

검증 대상: topics[].datasets[].table_name
검증 방법: catalog_index에 해당 table_name_kr이 존재하는지 dict 조회 (LLM 아님)
실패 시:  유사 테이블 제안 + 피드백 메시지 생성
"""

import re
from dataclasses import dataclass, field

from loguru import logger


# ─── 결과 데이터 클래스 ──────────────────────────────────────────────

@dataclass
class TableCheckResult:
    table_name: str       # Agent 2가 제안한 테이블명
    institution: str      # 해당 테이블이 속한 기관 (못 찾으면 "미확인")
    found: bool
    similar_tables: list[str] = field(default_factory=list)


@dataclass
class ValidationReport:
    all_valid: bool
    results: list[TableCheckResult] = field(default_factory=list)
    invalid_count: int = 0

    def valid_results(self) -> list[TableCheckResult]:
        return [r for r in self.results if r.found]

    def invalid_results(self) -> list[TableCheckResult]:
        return [r for r in self.results if not r.found]


# ─── CatalogValidator ────────────────────────────────────────────────

class CatalogValidator:
    """
    Agent 2가 제안한 테이블명을 catalog_index.json과 비교 검증.
    catalog_index 구조: { "기관명": [ {"table_name_kr": ..., ...} ] }
    """

    def __init__(self, catalog_index: dict):
        self.catalog_index = catalog_index
        # 빠른 조회용 플랫 맵: table_name_kr + table_name_en → 기관명
        self._table_map: dict[str, str] = {}
        for institution, tables in catalog_index.items():
            for t in tables:
                for key in ("table_name_kr", "table_name_en"):
                    name = t.get(key, "").strip()
                    if name:
                        self._table_map[name] = institution

        logger.debug(
            f"[CatalogValidator] 초기화 완료: "
            f"{len(self.catalog_index)}개 기관, {len(self._table_map)}개 테이블 인덱싱"
        )

    # ── 유사 테이블 탐색 ──────────────────────────────────────────────

    def _find_similar(self, name: str, max_results: int = 3) -> list[str]:
        """
        부분 문자열 + 토큰 매칭으로 유사 테이블명 탐색.
        우선순위: 직접 포함 > 토큰 매칭
        """
        direct: list[str] = []
        token: list[str] = []
        tokens = [t for t in re.split(r"[_\s]", name) if len(t) > 1]

        for tname in self._table_map:
            if name in tname or tname in name:
                direct.append(tname)
            elif tokens and any(tok in tname for tok in tokens):
                token.append(tname)

        candidates = (direct + token)[:max_results]
        return candidates

    # ── 테이블명 추출 ─────────────────────────────────────────────────

    @staticmethod
    def _extract_table_names(topics_data: dict) -> list[tuple[str, str]]:
        """
        topics_data에서 (table_name, context_label) 쌍 추출.
        지원하는 스키마 위치:
          - topics[].datasets[].table_name  (신규 스키마)
          - topics[].required_real_dataset[] (구형 스키마, 문자열에서 파싱)
          - mappings[].data_requirements[].dataset_name (구형 스키마)
        """
        names: list[tuple[str, str]] = []
        seen: set[str] = set()

        def add(name: str, label: str):
            # "(A기관) 테이블명" 형식에서 테이블명만 추출
            name = re.sub(r"^\([^)]+\)\s*", "", name).strip()
            # 제안/추가 등 명시적으로 표시된 가상 데이터는 스킵
            skip_keywords = ["제안", "추가", "필요", "미래", "구축예정", "없음"]
            if name and name not in seen and not any(kw in name for kw in skip_keywords):
                seen.add(name)
                names.append((name, label))

        # 신규 스키마: topics[].datasets[].table_name
        for i, topic in enumerate(topics_data.get("topics", [])):
            tid = topic.get("id", f"TOPIC_{i+1}")
            for ds in topic.get("datasets", []):
                tname = ds.get("table_name", "").strip()
                if tname:
                    add(tname, f"{tid}.datasets")

        # 구형 스키마: topics[].required_real_dataset[]
        for i, topic in enumerate(topics_data.get("topics", [])):
            tid = topic.get("id", f"TOPIC_{i+1}")
            for ref in topic.get("required_real_dataset", []):
                add(str(ref), f"{tid}.required_real_dataset")

        # 구형 스키마: mappings[].data_requirements[].dataset_name
        for mapping in topics_data.get("mappings", []):
            for req in mapping.get("data_requirements", []):
                tname = req.get("dataset_name", "").strip()
                if tname:
                    add(tname, "mappings.data_requirements")

        return names

    # ── 검증 실행 ──────────────────────────────────────────────────────

    def validate_topics(self, topics_data: dict) -> ValidationReport:
        """
        topics_data의 모든 테이블명을 catalog_index와 교차 검증.
        테이블이 0개 추출되면 (빈 결과) all_valid=False 처리.
        """
        name_pairs = self._extract_table_names(topics_data)

        if not name_pairs:
            logger.warning("[CatalogValidator] 검증할 테이블명이 없음 (topics 비어있거나 스키마 불일치)")
            return ValidationReport(all_valid=False, results=[], invalid_count=0)

        results: list[TableCheckResult] = []
        for name, _ in name_pairs:
            found = name in self._table_map
            results.append(TableCheckResult(
                table_name=name,
                institution=self._table_map.get(name, "미확인"),
                found=found,
                similar_tables=[] if found else self._find_similar(name),
            ))
            if not found:
                logger.debug(f"  [검증 실패] '{name}' — 유사: {self._find_similar(name)}")

        invalid = sum(1 for r in results if not r.found)
        logger.info(
            f"[CatalogValidator] 검증 완료: {len(results)}개 테이블 중 "
            f"{len(results)-invalid}개 통과, {invalid}개 실패"
        )
        return ValidationReport(
            all_valid=(invalid == 0),
            results=results,
            invalid_count=invalid,
        )

    # ── 피드백 메시지 생성 ─────────────────────────────────────────────

    @staticmethod
    def build_feedback(report: ValidationReport) -> str:
        """
        검증 실패 결과 → Agent 2 재요청용 피드백 문자열.
        유사 테이블명이 있으면 제시, 없으면 해당 분석 불가 안내.
        """
        if report.all_valid:
            return ""

        lines = [
            "## [검증 결과 — 수정 필요]",
            f"제안된 테이블 {report.invalid_count}개가 카탈로그에 존재하지 않습니다.",
            "아래를 참고하여 실제 존재하는 테이블명으로 분석 주제를 재구성해 주세요.\n",
        ]
        for r in report.invalid_results():
            lines.append(f"❌ **'{r.table_name}'** — 카탈로그 미존재")
            if r.similar_tables:
                lines.append(f"   유사 테이블 후보: {', '.join(r.similar_tables)}")
            else:
                lines.append("   유사 테이블 없음 → 이 데이터로는 해당 분석 구현 불가")

        lines += [
            "",
            "위 내용을 반영하여:",
            "1) 존재하는 테이블로 분석 주제를 재구성하거나",
            "2) 해당 주제를 'additional_data_needed' 필드에 '추가 데이터 필요'로 명시하세요.",
        ]
        return "\n".join(lines)

    # ── 추가 데이터 안내 생성 ──────────────────────────────────────────

    @staticmethod
    def build_insufficient_data_guidance(report: ValidationReport) -> str:
        """
        최대 재시도 초과 후 사용자에게 제공할 추가 데이터 입력 안내.
        """
        if report.all_valid:
            return ""

        lines = [
            "## 추가 데이터 입력 필요",
            "현재 제공된 카탈로그로는 다음 분석을 완전히 구현할 수 없습니다.",
            "아래 데이터를 data_catalog 폴더에 추가하고 Phase 1을 재실행하면",
            "더 구체적인 분석 주제 발굴이 가능합니다.\n",
        ]
        for r in report.invalid_results():
            if r.similar_tables:
                lines.append(
                    f"- '{r.table_name}' 또는 유사 데이터 "
                    f"({', '.join(r.similar_tables)}) 의 상세 메타데이터 추가"
                )
            else:
                lines.append(f"- '{r.table_name}' 관련 데이터 신규 수집 필요")

        return "\n".join(lines)
