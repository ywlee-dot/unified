/**
 * 한국표준시(KST) 날짜/시간 포매팅 헬퍼.
 * 백엔드에서 오는 ISO8601(UTC) 문자열을 Asia/Seoul 시간대로 일관되게 렌더링한다.
 * 프론트엔드의 모든 시간 표시는 이 헬퍼를 통해야 한다.
 */

const KST_TZ = "Asia/Seoul";

type FormatStyle = "datetime" | "datetime_sec" | "date" | "time" | "short";

/**
 * ISO8601 문자열을 KST로 포맷팅.
 *
 * @param iso 백엔드에서 받은 ISO8601 문자열 (UTC, Z 또는 +00:00 포함)
 * @param style
 *   - "datetime": YYYY-MM-DD HH:mm (기본)
 *   - "datetime_sec": YYYY-MM-DD HH:mm:ss
 *   - "date": YYYY-MM-DD
 *   - "time": HH:mm
 *   - "short": MM-DD HH:mm
 * @returns 포맷된 문자열. null/invalid 입력 시 "—" 반환.
 */
export function formatKst(
  iso: string | null | undefined,
  style: FormatStyle = "datetime",
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const base: Intl.DateTimeFormatOptions = {
    timeZone: KST_TZ,
    hour12: false,
  };

  switch (style) {
    case "date":
      return d.toLocaleDateString("ko-KR", {
        ...base,
        year: "numeric", month: "2-digit", day: "2-digit",
      });
    case "time":
      return d.toLocaleTimeString("ko-KR", {
        ...base,
        hour: "2-digit", minute: "2-digit",
      });
    case "short":
      return d.toLocaleString("ko-KR", {
        ...base,
        month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    case "datetime_sec":
      return d.toLocaleString("ko-KR", {
        ...base,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    case "datetime":
    default:
      return d.toLocaleString("ko-KR", {
        ...base,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
  }
}

/** 현재 KST 기준 시각을 "YYYY-MM-DD HH:mm:ss" 형식으로 반환 (디버깅/로그용). */
export function nowKst(): string {
  return formatKst(new Date().toISOString(), "datetime_sec");
}

/** 주어진 시각이 몇 분 전인지 문자열로 반환 ("3분 전", "2시간 전" 등). */
export function timeAgoKst(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return formatKst(iso, "date");
}
