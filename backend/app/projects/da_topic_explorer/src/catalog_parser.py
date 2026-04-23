# -*- coding: utf-8 -*-
"""
카탈로그 파서 — 메타데이터 XLSX → 구조화 JSON (catalog_index.json)

지원 형식:
  1. 표준 30컬럼 단일 시트 (현재 사용 형식)
  2. 테이블정의서 + 컬럼정의서 분리 시트

catalog_index.json 구조:
  {
    "기관명": [
      {
        "table_name_kr": "한글테이블명",
        "table_name_en": "ENGLISH_NAME",
        "system_name": "정보시스템명",
        "row_count": 1200,
        "generation_cycle": "월",
        "columns": [
          {"name_kr": "컬럼명", "name_en": "COL_NAME", "data_type": "VARCHAR2",
           "is_pk": false, "is_fk": false, "has_personal_info": false}
        ]
      }
    ]
  }
"""

import json
import re
from pathlib import Path
from typing import Optional

import pandas as pd
from loguru import logger


# ─── 컬럼 키워드 매핑 ──────────────────────────────────────────────
# 각 논리 키 → 실제 컬럼명에 포함될 키워드 목록
# _find_column()은 정확 매칭 우선, 이후 부분 매칭으로 fallback
COLUMN_KEY_MAP: dict[str, list[str]] = {
    "institution":      ["기관명"],
    "system_name":      ["정보시스템명"],
    "table_name_kr":    ["한글 테이블명"],          # "한글 테이블명(보유DB)"보다 먼저 정확 매칭
    "table_name_en":    ["영문 테이블명"],
    "table_public":     ["공개/비공개 여부(테이블)"],
    "row_count":        ["테이블 볼륨"],
    "generation_cycle": ["발생주기"],
    "col_name_kr":      ["한글 컬럼명"],             # "한글 컬럼명(보유DB)"보다 먼저 정확 매칭
    "col_name_en":      ["영문 컬럼명"],
    "col_public":       ["공개/비공개 여부(컬럼)"],
    "data_type":        ["데이터 타입"],
    "is_pk":            ["PK 정보"],
    "is_fk":            ["FK 정보"],
    "has_personal_info":["개인정보 여부"],
}


def _norm(s: str) -> str:
    """컬럼명 정규화: 공백 제거 + 소문자화"""
    return re.sub(r"\s+", "", str(s)).lower()


def _find_column(df: pd.DataFrame, keywords: list[str]) -> Optional[str]:
    """
    키워드로 DataFrame 컬럼명 탐색.
    1순위: 정규화 후 완전 일치
    2순위: 정규화 후 키워드가 컬럼명과 완전 일치 (보유DB 접미사 없는 것 선호)
    3순위: 부분 포함
    """
    norm_map = {_norm(c): c for c in df.columns}
    for kw in keywords:
        nkw = _norm(kw)
        # 정확 일치
        if nkw in norm_map:
            return norm_map[nkw]
    # 부분 매칭 (정확 일치 없을 때) — 더 짧은 컬럼명 우선 (보유DB 변종 배제)
    candidates = []
    for kw in keywords:
        nkw = _norm(kw)
        for nc, orig in norm_map.items():
            if nkw in nc:
                candidates.append((len(nc), orig))
    if candidates:
        return sorted(candidates)[0][1]
    return None


def _is_public(val) -> bool:
    """공개 여부 판정. 미기재는 공개로 처리."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return True
    return str(val).strip() in ("Y", "y", "01", "1", "공개", "TRUE", "true")


def _safe(row: pd.Series, col_name: Optional[str], default="") -> str:
    """행에서 값 안전 추출. None/NaN → default 반환."""
    if not col_name or col_name not in row.index:
        return default
    v = row[col_name]
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return default
    return str(v).strip()


# ─── CatalogParser ─────────────────────────────────────────────────

class CatalogParser:
    """메타데이터 XLSX 파일을 구조화 JSON으로 변환"""

    # ── 헤더 탐지 ──────────────────────────────────────────────────

    @staticmethod
    def _detect_header_row(raw_df: pd.DataFrame) -> int:
        """
        헤더 행 위치를 탐지.
        '기관명'이 반드시 포함되고, '테이블명' 또는 '컬럼명'도 포함된 행을 헤더로 판정.
        (row 1의 카테고리 그룹 헤더 '정보시스템 정보', '테이블 정보' 등과 구분하기 위해
         '기관명' 존재 여부를 필수 조건으로 사용)
        """
        for i, row in raw_df.iterrows():
            vals = [str(v) for v in row.values if pd.notna(v)]
            has_institution = any("기관명" in v for v in vals)
            has_table_or_col = any(
                "테이블명" in v or "컬럼명" in v for v in vals
            )
            if has_institution and has_table_or_col:
                return int(i)
        return 2  # 표준 형식 기본값 (0-indexed)

    # ── 단일/다중 시트 감지 ─────────────────────────────────────────

    def parse_file(self, file_path: Path) -> Optional[dict]:
        """단일 XLSX 파일 파싱 → {institution, tables} 반환"""
        try:
            xl = pd.ExcelFile(file_path)
            sheets = xl.sheet_names

            has_table_sheet = any(
                "테이블" in s or "TABLE" in s.upper() for s in sheets
            )
            has_col_sheet = any(
                "컬럼" in s or "COLUMN" in s.upper() for s in sheets
            )

            if has_table_sheet and has_col_sheet and len(sheets) >= 2:
                logger.info(f"  [다중 시트 형식] {file_path.name}")
                return self._parse_multi_sheet(xl, file_path)
            else:
                return self._parse_single_sheet(xl, file_path)

        except Exception as e:
            logger.error(f"카탈로그 파싱 실패 ({file_path.name}): {e}")
            return None

    # ── 단일 시트 파싱 ──────────────────────────────────────────────

    def _parse_single_sheet(self, xl: pd.ExcelFile, file_path: Path) -> dict:
        sheet = xl.sheet_names[0]
        raw = pd.read_excel(xl, sheet_name=sheet, header=None)
        hr = self._detect_header_row(raw)
        df = pd.read_excel(xl, sheet_name=sheet, header=hr)
        df = df.dropna(how="all").reset_index(drop=True)

        col_map = {k: _find_column(df, kws) for k, kws in COLUMN_KEY_MAP.items()}
        institution = self._get_institution_name(df, col_map, file_path)
        return self._build_catalog(df, col_map, institution)

    # ── 다중 시트 파싱 (테이블정의서 + 컬럼정의서) ────────────────────

    def _parse_multi_sheet(self, xl: pd.ExcelFile, file_path: Path) -> dict:
        sheets = xl.sheet_names

        # 테이블 정의 시트
        t_sheet = next(
            (s for s in sheets if "테이블" in s or "TABLE" in s.upper()),
            sheets[0]
        )
        # 컬럼 정의 시트
        c_sheet = next(
            (s for s in sheets if "컬럼" in s or "COLUMN" in s.upper()),
            sheets[1]
        )

        raw_t = pd.read_excel(xl, sheet_name=t_sheet, header=None)
        hr_t = self._detect_header_row(raw_t)
        df_t = pd.read_excel(xl, sheet_name=t_sheet, header=hr_t).dropna(how="all")

        raw_c = pd.read_excel(xl, sheet_name=c_sheet, header=None)
        hr_c = self._detect_header_row(raw_c)
        df_c = pd.read_excel(xl, sheet_name=c_sheet, header=hr_c).dropna(how="all")

        t_col_map = {k: _find_column(df_t, kws) for k, kws in COLUMN_KEY_MAP.items()}
        c_col_map = {k: _find_column(df_c, kws) for k, kws in COLUMN_KEY_MAP.items()}

        tname_t = t_col_map.get("table_name_kr")
        tname_c = c_col_map.get("table_name_kr")

        if tname_t and tname_c:
            # 테이블 정의 시트에서 테이블 수준 정보만 취함
            t_meta_cols = [tname_t] + [
                v for k, v in t_col_map.items()
                if v and k in ("table_name_en", "system_name", "row_count",
                               "generation_cycle", "table_public", "institution")
                and v != tname_t
            ]
            df_t_slim = df_t[list(dict.fromkeys(t_meta_cols))].drop_duplicates(subset=[tname_t])
            df_t_slim = df_t_slim.rename(columns={tname_t: "__tname__"})
            df_c = df_c.rename(columns={tname_c: "__tname__"})
            df = pd.merge(df_c, df_t_slim, on="__tname__", how="left")
            df = df.rename(columns={"__tname__": tname_c})

            merged_col_map = {k: _find_column(df, kws) for k, kws in COLUMN_KEY_MAP.items()}
            institution = self._get_institution_name(df, merged_col_map, file_path)
            return self._build_catalog(df, merged_col_map, institution)

        # 병합 실패 시 단일 시트 fallback
        logger.warning(f"다중 시트 병합 실패, 단일 시트로 재시도: {file_path.name}")
        return self._parse_single_sheet(xl, file_path)

    # ── 기관명 결정 ─────────────────────────────────────────────────

    @staticmethod
    def _get_institution_name(
        df: pd.DataFrame, col_map: dict, file_path: Path
    ) -> str:
        inst_col = col_map.get("institution")
        if inst_col and inst_col in df.columns:
            vals = df[inst_col].dropna().unique()
            if len(vals) > 0:
                return str(vals[0]).strip()
        # 파일명 폴백: "산업인력공단_메타데이터.xlsx" → "산업인력공단"
        stem = file_path.stem
        return stem.split("_")[0] if "_" in stem else stem

    # ── 카탈로그 JSON 빌드 ──────────────────────────────────────────

    @staticmethod
    def _build_catalog(
        df: pd.DataFrame, col_map: dict, institution: str
    ) -> dict:
        table_name_col = col_map.get("table_name_kr")
        if not table_name_col or table_name_col not in df.columns:
            logger.warning(f"테이블명 컬럼 없음 — {institution}")
            return {"institution": institution, "tables": []}

        tables: dict[str, dict] = {}

        for table_name, group in df.groupby(table_name_col, dropna=True):
            table_name = str(table_name).strip()
            if not table_name or table_name.lower() == "nan":
                continue

            first = group.iloc[0]

            # 비공개 테이블 제외
            if not _is_public(first.get(col_map.get("table_public", ""), "Y")):
                continue

            table_entry: dict = {
                "table_name_kr": table_name,
                "table_name_en": _safe(first, col_map.get("table_name_en")),
                "system_name":   _safe(first, col_map.get("system_name")),
                "row_count":     first.get(col_map.get("row_count", ""), None)
                                 if col_map.get("row_count") and col_map["row_count"] in first.index
                                 else None,
                "generation_cycle": _safe(first, col_map.get("generation_cycle")),
                "columns": [],
            }

            # row_count 정리 (numpy 타입 → Python 기본 타입)
            rc = table_entry["row_count"]
            if rc is None or (isinstance(rc, float) and pd.isna(rc)):
                table_entry["row_count"] = None
            else:
                try:
                    table_entry["row_count"] = int(rc)
                except (ValueError, TypeError):
                    table_entry["row_count"] = None

            col_name_col = col_map.get("col_name_kr")
            if col_name_col and col_name_col in df.columns:
                for _, row in group.iterrows():
                    col_kr = _safe(row, col_name_col)
                    if not col_kr or col_kr.lower() == "nan":
                        continue
                    # 비공개 컬럼 제외
                    if not _is_public(row.get(col_map.get("col_public", ""), "Y")):
                        continue
                    table_entry["columns"].append({
                        "name_kr":          col_kr,
                        "name_en":          _safe(row, col_map.get("col_name_en")),
                        "data_type":        _safe(row, col_map.get("data_type")),
                        "is_pk":            _safe(row, col_map.get("is_pk"), "N") == "Y",
                        "is_fk":            _safe(row, col_map.get("is_fk"), "N") == "Y",
                        "has_personal_info":_safe(row, col_map.get("has_personal_info"), "N") == "Y",
                    })

            tables[table_name] = table_entry

        return {"institution": institution, "tables": list(tables.values())}

    # ── 디렉토리 일괄 파싱 ──────────────────────────────────────────

    def parse_directory(self, dir_path: Path) -> dict:
        """
        data_catalog 디렉토리 내 모든 XLSX 파싱.
        반환: { "기관명": [테이블 목록], ... }
        """
        catalog_index: dict = {}
        for fp in sorted(dir_path.glob("*.xlsx")):
            logger.info(f"카탈로그 파싱: {fp.name}")
            result = self.parse_file(fp)
            if result:
                inst = result["institution"]
                catalog_index[inst] = result["tables"]
                logger.info(
                    f"  → {inst}: {len(result['tables'])}개 테이블, "
                    f"{sum(len(t['columns']) for t in result['tables'])}개 컬럼"
                )
        return catalog_index

    # ── 저장 / 로드 ─────────────────────────────────────────────────

    @staticmethod
    def save_catalog_index(catalog_index: dict, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(catalog_index, f, ensure_ascii=False, indent=2)
        total_tables = sum(len(v) for v in catalog_index.values())
        logger.info(
            f"catalog_index.json 저장: {output_path} "
            f"({len(catalog_index)}개 기관, {total_tables}개 테이블)"
        )

    @staticmethod
    def load_catalog_index(index_path: Path) -> dict:
        if not index_path.exists():
            logger.warning(f"catalog_index.json 없음: {index_path}")
            return {}
        with open(index_path, "r", encoding="utf-8") as f:
            return json.load(f)

    # ── 필터링 ──────────────────────────────────────────────────────

    @staticmethod
    def filter_by_keywords(
        catalog_index: dict,
        institution_names: list[str],
        domain_keywords: list[str],
    ) -> dict:
        """
        기관명 + 도메인 키워드로 관련 테이블만 추려서 반환.
        - institution_names: 빈 리스트면 전체 기관 포함
        - domain_keywords: 빈 리스트면 기관 내 전체 테이블 포함
        테이블명 · 시스템명 · 컬럼명 중 하나라도 키워드 포함 시 선택.
        """
        result: dict = {}
        for institution, tables in catalog_index.items():
            # 기관 매칭: 부분 포함 (양방향)
            if institution_names:
                matched = any(
                    n in institution or institution in n
                    for n in institution_names
                )
                if not matched:
                    continue

            if not domain_keywords:
                result[institution] = tables
                continue

            filtered = []
            for t in tables:
                searchable = (
                    t["table_name_kr"] + " "
                    + t.get("system_name", "") + " "
                    + " ".join(c["name_kr"] for c in t.get("columns", []))
                )
                if any(kw in searchable for kw in domain_keywords):
                    filtered.append(t)

            if filtered:
                result[institution] = filtered

        return result

    # ── 프롬프트용 포맷 변환 ────────────────────────────────────────

    @staticmethod
    def format_for_prompt(filtered_catalog: dict) -> str:
        """
        필터링된 카탈로그 → Agent 2 프롬프트에 삽입할 구조화 텍스트.
        컬럼 목록 포함 (상세).
        """
        if not filtered_catalog:
            return "필터링된 카탈로그 없음"

        lines = []
        for institution, tables in filtered_catalog.items():
            lines.append(f"\n### [{institution}] ({len(tables)}개 테이블)")
            for t in tables:
                pk_cols = [c["name_kr"] for c in t.get("columns", []) if c.get("is_pk")]
                col_names = [c["name_kr"] for c in t.get("columns", [])]
                rc = t.get("row_count")
                rc_str = f"{int(rc):,}행" if rc and not pd.isna(rc) else "행수 미상"
                lines.append(
                    f"\n  ■ **{t['table_name_kr']}** ({t.get('table_name_en', '')}) "
                    f"| 시스템: {t.get('system_name', '')} | {rc_str}"
                )
                lines.append(f"    컬럼({len(col_names)}개): {', '.join(col_names)}")
                if pk_cols:
                    lines.append(f"    PK: {', '.join(pk_cols)}")
        return "\n".join(lines)

    @staticmethod
    def format_summary_for_agent1(catalog_index: dict) -> str:
        """
        Agent 1용 카탈로그 요약 — 테이블명 + 시스템명만 (컬럼 생략).
        컨텍스트 절약용.
        """
        if not catalog_index:
            return "카탈로그 없음"
        lines = []
        for institution, tables in catalog_index.items():
            lines.append(f"\n### [{institution}] ({len(tables)}개 테이블)")
            for t in tables:
                lines.append(
                    f"  - {t['table_name_kr']} (시스템: {t.get('system_name', '')})"
                )
        return "\n".join(lines)
