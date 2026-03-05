"""Constants for the gov_news_crawler project."""

# Scoring weights (must sum to 1.0)
SCORING_WEIGHTS = {
    "keyword": 0.4,
    "position": 0.25,
    "source": 0.2,
    "recency": 0.15,
}

# How to combine rule-based and AI scores
SCORE_COMBINE_WEIGHTS = {
    "with_ai": {"rule": 0.4, "ai": 0.6},
    "without_ai": {"rule": 1.0},
}

# Deduplication
TITLE_SIMILARITY_THRESHOLD = 0.85

# AI scoring
DEFAULT_AI_TOP_N = 20

# Keyword scoring point values
KEYWORD_POINTS = 15
SYNONYM_POINTS = 10
ENTITY_POINTS = 20

# Position scoring point values
POSITION_POINTS = {
    "title": 40,
    "lead": 30,
    "content": 15,
    "entity_title": 20,
    "entity_lead": 10,
}

# Number of characters considered "lead" (opening of article)
LEAD_LENGTH = 200

# Recency thresholds in hours and their scores
RECENCY_THRESHOLDS = [
    (24, 100),       # <= 24 hours  -> 100
    (72, 80),        # <= 3 days    -> 80
    (168, 60),       # <= 7 days    -> 60
    (672, 40),       # <= 28 days   -> 40
]
RECENCY_SCORE_OLD = 20       # older than 28 days
RECENCY_SCORE_UNKNOWN = 50   # no published_at
