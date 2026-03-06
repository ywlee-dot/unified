"""Parse HWPX (2025 평가편람) and generate evaluation_items.json for RAG ingestion.

Usage:
    python -m app.projects.evaluation_rag.scripts.parse_hwpx
    python -m app.projects.evaluation_rag.scripts.parse_hwpx --dry-run
"""

import argparse
import json
import logging
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

HWPX_PATH = Path(__file__).parent.parent / "data" / "1. 2025년 공공데이터 제공 및 데이터기반행정 평가편람(수정본).hwpx"
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "evaluation_items.json"

# 두 개의 별도 평가 체계 (각 100점 + 가점)
# 공공데이터 제공 평가: 개방·활용(48) + 품질(45) + 관리체계_공(7) = 100점
# 데이터기반행정 평가: 분석·활용(50) + 공유(45) + 관리체계_행(5) = 100점

EVALUATIONS = {
    "public_data": {
        "name_ko": "공공데이터 제공 평가",
        "total_score": 100,
        "bonus_score": 5,
    },
    "data_admin": {
        "name_ko": "데이터기반행정 평가",
        "total_score": 100,
        "bonus_score": 5,
    },
}

CATEGORIES = [
    {
        "category_en": "openness",
        "category_ko": "개방·활용",
        "area_number": "1",
        "indicator_prefix": "󰊱",
        "evaluation_type": "public_data",
        "area_score": 48,
        "description": "공공데이터 저변확대를 위해 공공데이터 개방 확대 및 개방 관리 노력 수준을 평가",
    },
    {
        "category_en": "quality",
        "category_ko": "품질",
        "area_number": "2",
        "indicator_prefix": "󰊲",
        "evaluation_type": "public_data",
        "area_score": 45,
        "description": "각 기관이 구축·운영하고 있는 DB의 품질 제고를 위해 수행하는 품질관리 활동을 평가",
    },
    {
        "category_en": "management_pub",
        "category_ko": "관리체계(공공데이터)",
        "area_number": "5",
        "indicator_prefix": "󰊵",
        "evaluation_type": "public_data",
        "area_score": 7,
        "description": "공공데이터 정책의 추진기반 조성 및 교육 참여를 평가",
    },
    {
        "category_en": "analysis",
        "category_ko": "분석·활용",
        "area_number": "3",
        "indicator_prefix": "󰊳",
        "evaluation_type": "data_admin",
        "area_score": 50,
        "description": "데이터 분석·활용 실적 및 성과, AI·데이터기반행정 리터러시 및 교육 실적 등을 평가",
    },
    {
        "category_en": "sharing",
        "category_ko": "공유",
        "area_number": "4",
        "indicator_prefix": "󰊴",
        "evaluation_type": "data_admin",
        "area_score": 45,
        "description": "공유데이터 구축 및 제공 노력, 메타데이터 등록 및 관리 등을 평가",
    },
    {
        "category_en": "management_dba",
        "category_ko": "관리체계(데이터기반행정)",
        "area_number": "5",
        "indicator_prefix": "󰊵",
        "evaluation_type": "data_admin",
        "area_score": 5,
        "description": "데이터기반행정 추진기반 조성 및 기관장 추진 의지를 평가",
    },
]

# 지표별 메타정보
INDICATORS_META = {
    # === 공공데이터 제공 평가 (100점) ===
    # 개방·활용 (48점)
    "openness_01": {"item_name": "메타관리시스템 기반 공공데이터 개방계획 수립 및 이행률", "max_score": 10, "method": "정량"},
    "openness_02": {"item_name": "AI 친화·고가치 데이터 개방 노력", "max_score": 10, "method": "정성"},
    "openness_03": {"item_name": "개방데이터 이용자 지원 실적", "max_score": 8, "method": "정량"},
    "openness_04": {"item_name": "공공데이터 활용도 제고 노력 및 성과", "max_score": 20, "method": "정량+정성"},
    "openness_05": {"item_name": "가명정보 제공 및 합성데이터 개방 실적", "max_score": 5, "method": "정량", "is_bonus": True},
    # 품질 (45점)
    "quality_01": {"item_name": "데이터 품질관리 체계", "max_score": 17, "method": "정량"},
    "quality_02": {"item_name": "데이터 값 관리", "max_score": 18, "method": "정량"},
    "quality_03": {"item_name": "진단결과 조치", "max_score": 10, "method": "정량"},
    # 관리체계_공 (7점)
    "management_pub_01": {"item_name": "추진기반 조성(공공데이터)", "max_score": 3, "method": "정량"},
    "management_pub_02": {"item_name": "공공데이터 제공 관련 교육 참여", "max_score": 4, "method": "정량"},
    # === 데이터기반행정 평가 (100점) ===
    # 분석·활용 (50점)
    "analysis_01": {"item_name": "데이터 분석·활용 실적 및 성과", "max_score": 25, "method": "정량+정성"},
    "analysis_02": {"item_name": "AI·데이터기반행정 리터러시 및 교육 실적", "max_score": 10, "method": "정량"},
    "analysis_03": {"item_name": "데이터기반행정 활성화 노력 및 실적", "max_score": 15, "method": "정성"},
    # 공유 (45점)
    "sharing_01": {"item_name": "공유데이터 구축 로드맵 수립이행 및 등록 이행률", "max_score": 14, "method": "정량"},
    "sharing_02": {"item_name": "공유데이터 제공 노력 및 실적", "max_score": 10, "method": "정성"},
    "sharing_03": {"item_name": "기관공유데이터 관리시스템 구축 실적", "max_score": 6, "method": "정량"},
    "sharing_04": {"item_name": "메타데이터의 등록 및 관리", "max_score": 8, "method": "정량"},
    "sharing_05": {"item_name": "AI 학습용 데이터 제공 실적", "max_score": 7, "method": "정량"},
    "sharing_06": {"item_name": "가명정보 제공 및 합성데이터 공유 실적", "max_score": 5, "method": "정량", "is_bonus": True},
    # 관리체계_행 (5점)
    "management_dba_01": {"item_name": "추진기반 조성(데이터기반행정)", "max_score": 3, "method": "정량"},
    "management_dba_02": {"item_name": "기관장 추진 의지", "max_score": 2, "method": "정량"},
}


def extract_text_from_hwpx(hwpx_path: Path) -> str:
    """Extract all text from HWPX file sections."""
    all_text = []

    with zipfile.ZipFile(hwpx_path, "r") as zf:
        section_files = sorted(
            [n for n in zf.namelist() if n.startswith("Contents/section") and n.endswith(".xml")]
        )
        for section_file in section_files:
            data = zf.read(section_file)
            root = ET.fromstring(data)
            texts = []
            for elem in root.iter():
                if elem.text and elem.text.strip():
                    texts.append(elem.text.strip())
                if elem.tail and elem.tail.strip():
                    texts.append(elem.tail.strip())
            all_text.append("\n".join(texts))

    return "\n\n".join(all_text)


def split_by_indicators(full_text: str) -> dict[str, str]:
    """Split full text into sections by ｢...｣ 지표 header pattern.

    The detailed sections in the document start with patterns like:
      ｢ 󰊱-① 메타관리시스템 기반 ...｣ 지표    (pos ~12984)
      ｢󰊲 -① 데이터 품질관리 체계｣ 지표       (pos ~33469)
      ｢ 󰊵-② 기관장의 추진 의지｣ 지표         (pos ~89626)

    Spacing is inconsistent: prefix may have space before/after dash.
    """
    indicator_markers = [
        ("󰊱", "openness"),
        ("󰊲", "quality"),
        ("󰊳", "analysis"),
        ("󰊴", "sharing"),
        ("󰊵", "management"),
    ]

    circled_nums = "①②③④⑤⑥⑦⑧⑨⑩"
    prefix_chars = "".join(m[0] for m in indicator_markers)

    # Find all ｢...지표 headers with their positions
    # Pattern: ｢ (optional space) prefix (optional space) - (optional space) circled_num ... ｣ ... 지표
    header_pattern = re.compile(
        r"[｢「]\s*([" + prefix_chars + r"])\s*-\s*([" + circled_nums + r"])[^｣」]*[｣」]\s*지표"
    )

    prefix_to_category = dict(indicator_markers)

    # Collect all detailed section positions
    sections: dict[str, int] = {}
    # Track management duplicates: 공공데이터 has ①②, 데이터기반행정 also has ①②
    management_matches: list[tuple[int, str, int]] = []  # (pos, circled_num, num)

    for match in header_pattern.finditer(full_text):
        prefix_char = match.group(1)
        circled_num = match.group(2)
        category = prefix_to_category.get(prefix_char)
        if not category:
            continue

        num = circled_nums.index(circled_num) + 1
        pos = match.start()

        if category == "management":
            management_matches.append((pos, circled_num, num))
            continue

        item_id = f"{category}_{num:02d}"
        if item_id not in INDICATORS_META:
            continue

        if item_id in sections:
            continue

        sections[item_id] = pos

    # Handle management: assign in document order
    # 공데 ①=추진기반(공), 공데 ②=교육참여, 데기행 ①=추진기반(행), 데기행 ②=기관장
    management_matches.sort(key=lambda x: x[0])
    mgmt_counter = 0
    mgmt_ids = ["management_pub_01", "management_pub_02", "management_dba_01", "management_dba_02"]
    for pos, cn, num in management_matches:
        if mgmt_counter >= len(mgmt_ids):
            break
        mid = mgmt_ids[mgmt_counter]
        if mid in INDICATORS_META:
            sections[mid] = pos
        mgmt_counter += 1

    # Sort by position and extract text between sections
    sorted_items = sorted(
        [(k, v) for k, v in sections.items() if not k.startswith("_")],
        key=lambda x: x[1],
    )
    result = {}

    for i, (item_id, start_pos) in enumerate(sorted_items):
        if i + 1 < len(sorted_items):
            end_pos = sorted_items[i + 1][1]
        else:
            # End at the appendix section or end of text
            for marker in ["[첨부]", "정성평가 작성양식", "보고서 양식"]:
                appendix_pos = full_text.find(marker, start_pos + 500)
                if appendix_pos != -1:
                    end_pos = appendix_pos
                    break
            else:
                end_pos = len(full_text)

        section_text = full_text[start_pos:end_pos].strip()
        # Cap at 8000 chars per chunk for RAG
        if len(section_text) > 8000:
            section_text = section_text[:8000]
        result[item_id] = section_text

    return result


def extract_keywords(text: str, item_name: str) -> list[str]:
    """Extract relevant keywords from section text."""
    # Common keyword patterns in the evaluation manual
    keywords = set()

    # Add words from item name
    for word in re.findall(r"[가-힣]+", item_name):
        if len(word) >= 2:
            keywords.add(word)

    # Extract key terms from the text
    key_patterns = [
        r"평가대상\s*([가-힣A-Za-z·]+)",
        r"([가-힣]{2,6})\s*(?:여부|정도|수준|실적|현황|노력|성과)",
        r"(?:정량|정성)\s*평가",
    ]
    for pattern in key_patterns:
        for match in re.findall(pattern, text[:2000]):
            if isinstance(match, str) and len(match) >= 2:
                keywords.add(match)

    # Add domain-specific keywords based on category
    domain_keywords = {
        "openness": ["개방", "공공데이터", "포털", "메타데이터", "이행률"],
        "quality": ["품질", "진단", "오류", "표준", "DB", "데이터베이스"],
        "analysis": ["분석", "활용", "AI", "리터러시", "정책"],
        "sharing": ["공유", "로드맵", "등록", "메타데이터", "관리시스템"],
        "management": ["관리체계", "추진기반", "교육", "기관장"],
    }

    category = item_name.split("_")[0] if "_" in item_name else ""
    for cat, kws in domain_keywords.items():
        if cat in category or any(kw in text[:1000] for kw in kws):
            keywords.update(kws)
            break

    return sorted(list(keywords))[:15]


def build_evaluation_items(full_text: str) -> dict:
    """Build the evaluation_items.json structure from parsed text."""
    sections = split_by_indicators(full_text)

    categories_output = []

    for cat_def in CATEGORIES:
        cat_en = cat_def["category_en"]
        items = []

        for item_id, meta in INDICATORS_META.items():
            if not item_id.startswith(cat_en):
                continue

            section_text = sections.get(item_id, "")
            if not section_text:
                logger.warning(f"No text found for {item_id}: {meta['item_name']}")
                # Still include with empty scoring_criteria
                section_text = meta["item_name"]

            keywords = extract_keywords(section_text, meta["item_name"])

            item = {
                "item_id": item_id,
                "item_name": meta["item_name"],
                "description": f"{cat_def['category_ko']} 영역 - {meta['item_name']}에 대한 평가",
                "max_score": meta["max_score"],
                "method": meta["method"],
                "scoring_criteria": section_text,
                "keywords": keywords,
            }
            if meta.get("is_bonus"):
                item["is_bonus"] = True

            items.append(item)
            logger.info(
                f"  [{item_id}] {meta['item_name']} "
                f"(max_score={meta['max_score']}, text_len={len(section_text)})"
            )

        area_total = sum(i["max_score"] for i in items if not i.get("is_bonus"))
        categories_output.append({
            "category_en": cat_en,
            "category_ko": cat_def["category_ko"],
            "evaluation_type": cat_def["evaluation_type"],
            "area_score": cat_def["area_score"],
            "description": cat_def["description"],
            "items": items,
        })

        logger.info(
            f"Category '{cat_en}' ({cat_def['category_ko']}): "
            f"{len(items)} items, {area_total}점 (expected {cat_def['area_score']}점)"
        )

    # Verify totals
    for eval_type, eval_info in EVALUATIONS.items():
        total = sum(
            c["area_score"] for c in categories_output
            if c["evaluation_type"] == eval_type
        )
        logger.info(f"{eval_info['name_ko']}: {total}점 (expected {eval_info['total_score']}점)")

    return {
        "version": "2.0.0",
        "source": "2025년 공공데이터 제공 및 데이터기반행정 평가편람(수정본).hwpx",
        "description": "2025년 공공데이터 관리수준 평가편람 - HWPX 원본에서 자동 추출된 평가항목 데이터",
        "evaluations": EVALUATIONS,
        "categories": categories_output,
    }


def main():
    parser = argparse.ArgumentParser(description="Parse HWPX and generate evaluation_items.json")
    parser.add_argument("--dry-run", action="store_true", help="Print stats without writing")
    args = parser.parse_args()

    if not HWPX_PATH.exists():
        logger.error(f"HWPX file not found: {HWPX_PATH}")
        return

    logger.info(f"Parsing HWPX: {HWPX_PATH}")
    full_text = extract_text_from_hwpx(HWPX_PATH)
    logger.info(f"Extracted {len(full_text)} characters from HWPX")

    data = build_evaluation_items(full_text)

    total_items = sum(len(c["items"]) for c in data["categories"])
    logger.info(f"Total: {total_items} items across {len(data['categories'])} categories")

    if args.dry_run:
        logger.info("[DRY RUN] Would write to: %s", OUTPUT_PATH)
        print(json.dumps(data, ensure_ascii=False, indent=2)[:5000])
        return

    # Backup existing file
    if OUTPUT_PATH.exists():
        backup_path = OUTPUT_PATH.with_suffix(".json.bak")
        OUTPUT_PATH.rename(backup_path)
        logger.info(f"Backed up existing file to: {backup_path}")

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logger.info(f"Written to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
