# Confidence Scoring

## Bands

- high: `confidence >= 0.80`
- medium: `0.50 <= confidence < 0.80`
- low: `confidence < 0.50`

## Detail Thresholds

- facade detail: property confidence `>= 0.75`
- roof detail: property confidence `>= 0.85`
- landmark asset: entity confidence `>= 0.90`

## Inputs

- source reliability
- recency
- geometric consistency
- cross-source agreement
- manual/curated approval status
