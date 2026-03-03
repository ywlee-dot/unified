"""Dummy data for Dataset Summary project."""

MOCK_SUMMARY_RESULT = {
    "results": [
        {
            "row_index": 1,
            "group_key": "1",
            "common": {
                "번호": "1",
                "개방 데이터셋명": "공공시설 이용현황",
                "정보시스템명": "시설관리시스템",
                "테이블명(한글)": "시설이용내역",
                "테이블명(영문)": "TB_FACILITY_USAGE",
            },
            "columns": [
                "시설명 (FACILITY_NM)",
                "이용일자 (USE_DT)",
                "이용인원 (USE_CNT)",
                "예약상태 (RSV_STATUS)",
            ],
            "keywords": [
                "공공시설",
                "이용현황",
                "예약",
                "시설관리",
                "이용인원",
                "통계",
                "시설운영",
                "이용분석",
            ],
            "description": (
                "해당 기관의 공공시설 이용현황 관련 데이터 정보입니다. "
                "시설관리시스템에서 수집된 시설 이용 내역을 기반으로, "
                "시설명, 이용일자, 이용인원, 예약상태 등의 핵심 항목을 포함하고 있습니다. "
                "이 데이터를 통해 시설 운영 효율화 및 이용 패턴 분석이 가능합니다."
            ),
        }
    ],
    "debug": None,
}


def get_mock_summary():
    return MOCK_SUMMARY_RESULT
