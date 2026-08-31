"""Reference oracle for the calculation-parity test.

Contains the ORIGINAL backend heuristics, copied verbatim from the FastAPI
project's server.py (_estimate_health_score / _estimate_money_lost_weekly) and
data_source.py (_seeded_metrics). Stdlib-only (hashlib, math) so it runs without
installing the backend's dependencies.

It generates a comprehensive, deterministic grid of inputs, computes the original
outputs, and prints them as JSON. scripts/parity/run.mjs recomputes the same
inputs with the SvelteKit port and asserts byte-identical results.
"""
import hashlib
import json
import math

BENCHMARK_RATING = 4.7
ASSUMED_WEEKLY_REVENUE = 12000.0
REVENUE_PER_STAR = 0.07
VISIBILITY_REVIEW_FLOOR = 150
VISIBILITY_PENALTY = 0.03


def estimate_health_score(rating, review_count):
    rating = rating or 0.0
    review_count = review_count or 0
    rating_score = max(0.0, min(1.0, (rating - 2.5) / 2.5))
    volume_score = max(0.0, min(1.0, math.log10(review_count + 1) / math.log10(1000)))
    score = round((0.75 * rating_score + 0.25 * volume_score) * 100)
    return int(max(0, min(100, score)))


def estimate_money_lost_weekly(rating, review_count):
    rating = rating or 0.0
    review_count = review_count or 0
    reputation_loss = ASSUMED_WEEKLY_REVENUE * REVENUE_PER_STAR * max(0.0, BENCHMARK_RATING - rating)
    visibility_loss = 0.0
    if review_count < VISIBILITY_REVIEW_FLOOR:
        shortfall = (VISIBILITY_REVIEW_FLOOR - review_count) / VISIBILITY_REVIEW_FLOOR
        visibility_loss = ASSUMED_WEEKLY_REVENUE * VISIBILITY_PENALTY * shortfall
    return int(round(reputation_loss + visibility_loss))


def seeded_metrics(key):
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    a = int.from_bytes(digest[0:4], "big") / 0xFFFFFFFF
    b = int.from_bytes(digest[4:8], "big") / 0xFFFFFFFF
    rating = round(3.2 + a * (4.8 - 3.2), 1)
    review_count = int(20 + b * (400 - 20))
    return rating, review_count


def build_inputs():
    ratings = [None]
    r = 0.0
    while r <= 5.0000001:
        ratings.append(round(r, 2))
        r += 0.01
    review_counts = [None, 0, 1, 2, 3, 4, 5, 10, 20, 50, 100, 148, 149, 150, 151, 200, 300, 500, 1000, 2000, 5000]
    return ratings, review_counts


def main():
    ratings, review_counts = build_inputs()

    health_money = []
    for rating in ratings:
        for rc in review_counts:
            health_money.append({
                "rating": rating,
                "review_count": rc,
                "health": estimate_health_score(rating, rc),
                "money": estimate_money_lost_weekly(rating, rc),
            })

    seeded = []
    # place_id-style numeric keys + a few display-name style keys.
    keys = [str(i) for i in range(0, 30000)]
    keys += [
        "Katz's Delicatessen, New York, USA",
        "Franklin Barbecue, Austin, TX",
        "Pike Place Chowder, Seattle, WA",
        "Joe's Pizza",
        "The Corner Bistro, West Village",
    ]
    for key in keys:
        rating, rc = seeded_metrics(key)
        seeded.append({"key": key, "rating": rating, "review_count": rc})

    print(json.dumps({"health_money": health_money, "seeded": seeded}))


if __name__ == "__main__":
    main()
