"""
NBA Stats Collector API for Railway
Simple FastAPI server to collect NBA stats via nba_api
"""

import os
import json
from datetime import datetime
from typing import Optional

import psycopg2
from fastapi import FastAPI, HTTPException, Header
from nba_api.stats.endpoints import leaguedashteamstats

app = FastAPI(title="NBA Stats Collector API")

# Environment variables
DATABASE_URL = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
CRON_SECRET = os.environ.get("CRON_SECRET")


def get_current_season() -> str:
    """Get current NBA season string (e.g., '2025-26')"""
    today = datetime.now()
    year = today.year
    month = today.month
    if month >= 10:
        return f"{year}-{str(year + 1)[-2:]}"
    else:
        return f"{year - 1}-{str(year)[-2:]}"


def fetch_team_stats(season: str) -> list[dict]:
    """Fetch team stats from NBA.com"""
    print(f"Fetching team stats for season {season}...")

    # Get traditional stats
    traditional = leaguedashteamstats.LeagueDashTeamStats(
        season=season,
        season_type_all_star="Regular Season",
        per_mode_detailed="PerGame"
    )
    traditional_df = traditional.get_data_frames()[0]

    # Get advanced stats
    advanced = leaguedashteamstats.LeagueDashTeamStats(
        season=season,
        season_type_all_star="Regular Season",
        measure_type_detailed_defense="Advanced"
    )
    advanced_df = advanced.get_data_frames()[0]

    results = []
    for _, row in traditional_df.iterrows():
        team_id = row["TEAM_ID"]
        team_name = row["TEAM_NAME"]

        adv_row = advanced_df[advanced_df["TEAM_ID"] == team_id]
        if adv_row.empty:
            continue
        adv_row = adv_row.iloc[0]

        results.append({
            "nba_team_id": int(team_id),
            "team_name": team_name,
            "season": season,
            "off_rating": float(adv_row.get("OFF_RATING", 0)) if adv_row.get("OFF_RATING") else None,
            "pace": float(adv_row.get("PACE", 0)) if adv_row.get("PACE") else None,
            "fg_pct": float(row.get("FG_PCT", 0)) if row.get("FG_PCT") else None,
            "fg3_pct": float(row.get("FG3_PCT", 0)) if row.get("FG3_PCT") else None,
            "ft_pct": float(row.get("FT_PCT", 0)) if row.get("FT_PCT") else None,
            "ast_pct": float(adv_row.get("AST_PCT", 0)) if adv_row.get("AST_PCT") else None,
            "tov_pct": float(adv_row.get("TM_TOV_PCT", 0)) if adv_row.get("TM_TOV_PCT") else None,
            "def_rating": float(adv_row.get("DEF_RATING", 0)) if adv_row.get("DEF_RATING") else None,
            "reb_pct": float(adv_row.get("REB_PCT", 0)) if adv_row.get("REB_PCT") else None,
            "dreb_pct": float(adv_row.get("DREB_PCT", 0)) if adv_row.get("DREB_PCT") else None,
            "oreb_pct": float(adv_row.get("OREB_PCT", 0)) if adv_row.get("OREB_PCT") else None,
            "net_rating": float(adv_row.get("NET_RATING", 0)) if adv_row.get("NET_RATING") else None,
            "avg_pts": float(row.get("PTS", 0)) if row.get("PTS") else None,
            "avg_reb": float(row.get("REB", 0)) if row.get("REB") else None,
            "avg_ast": float(row.get("AST", 0)) if row.get("AST") else None,
            "avg_stl": float(row.get("STL", 0)) if row.get("STL") else None,
            "avg_blk": float(row.get("BLK", 0)) if row.get("BLK") else None,
            "avg_tov": float(row.get("TOV", 0)) if row.get("TOV") else None,
            "raw_data": {
                "traditional": {k: (float(v) if isinstance(v, (int, float)) else str(v)) for k, v in row.to_dict().items()},
                "advanced": {k: (float(v) if isinstance(v, (int, float)) else str(v)) for k, v in adv_row.to_dict().items()}
            }
        })

    print(f"Fetched stats for {len(results)} teams")
    return results


def get_team_id_mapping(conn) -> dict[str, str]:
    """Get mapping of team name to internal team ID"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, "externalId"
        FROM "Team"
        WHERE "sportType" = 'BASKETBALL'
    """)
    rows = cursor.fetchall()
    cursor.close()

    mapping = {}
    for row in rows:
        team_id, name, external_id = row
        normalized = name.lower().strip()
        mapping[normalized] = team_id
        if external_id:
            mapping[external_id.lower()] = team_id

    return mapping


def upsert_stats(conn, stats: list[dict], team_mapping: dict[str, str]) -> dict:
    """Insert or update team advanced stats"""
    cursor = conn.cursor()

    inserted = 0
    updated = 0
    skipped = 0

    for stat in stats:
        team_name = stat["team_name"]
        normalized = team_name.lower().strip()

        team_id = team_mapping.get(normalized)

        if not team_id:
            for db_name, db_id in team_mapping.items():
                if normalized.endswith(db_name) or db_name.endswith(normalized.split()[-1]):
                    team_id = db_id
                    break

        if not team_id:
            print(f"  WARNING: Could not find team: {team_name}")
            skipped += 1
            continue

        cursor.execute("""
            SELECT id FROM "TeamAdvancedStats"
            WHERE "teamId" = %s AND "sportType" = 'BASKETBALL' AND season = %s
        """, (team_id, stat["season"]))
        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                UPDATE "TeamAdvancedStats" SET
                    "offRating" = %s, pace = %s, "fgPct" = %s, "fg3Pct" = %s,
                    "ftPct" = %s, "astPct" = %s, "tovPct" = %s, "defRating" = %s,
                    "rebPct" = %s, "drebPct" = %s, "orebPct" = %s, "netRating" = %s,
                    "avgPts" = %s, "avgReb" = %s, "avgAst" = %s, "avgStl" = %s,
                    "avgBlk" = %s, "avgTov" = %s, "rawData" = %s, "updatedAt" = NOW()
                WHERE id = %s
            """, (
                stat["off_rating"], stat["pace"], stat["fg_pct"], stat["fg3_pct"],
                stat["ft_pct"], stat["ast_pct"], stat["tov_pct"], stat["def_rating"],
                stat["reb_pct"], stat["dreb_pct"], stat["oreb_pct"], stat["net_rating"],
                stat["avg_pts"], stat["avg_reb"], stat["avg_ast"], stat["avg_stl"],
                stat["avg_blk"], stat["avg_tov"], json.dumps(stat["raw_data"]),
                existing[0]
            ))
            updated += 1
        else:
            cursor.execute("""
                INSERT INTO "TeamAdvancedStats" (
                    id, "teamId", "sportType", season,
                    "offRating", pace, "fgPct", "fg3Pct", "ftPct", "astPct", "tovPct",
                    "defRating", "rebPct", "drebPct", "orebPct", "netRating",
                    "avgPts", "avgReb", "avgAst", "avgStl", "avgBlk", "avgTov",
                    "rawData", "createdAt", "updatedAt"
                ) VALUES (
                    gen_random_uuid(), %s, 'BASKETBALL', %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, NOW(), NOW()
                )
            """, (
                team_id, stat["season"],
                stat["off_rating"], stat["pace"], stat["fg_pct"], stat["fg3_pct"],
                stat["ft_pct"], stat["ast_pct"], stat["tov_pct"], stat["def_rating"],
                stat["reb_pct"], stat["dreb_pct"], stat["oreb_pct"], stat["net_rating"],
                stat["avg_pts"], stat["avg_reb"], stat["avg_ast"], stat["avg_stl"],
                stat["avg_blk"], stat["avg_tov"], json.dumps(stat["raw_data"])
            ))
            inserted += 1

    conn.commit()
    cursor.close()

    return {"inserted": inserted, "updated": updated, "skipped": skipped}


def verify_auth(authorization: Optional[str]) -> bool:
    """Verify authorization header"""
    if not CRON_SECRET:
        return True  # No secret configured, allow all
    if not authorization:
        return False
    return authorization == f"Bearer {CRON_SECRET}"


@app.get("/")
async def root():
    return {"status": "ok", "service": "NBA Stats Collector API"}


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/collect-nba-stats")
async def collect_nba_stats(authorization: Optional[str] = Header(None)):
    """Collect NBA stats and store in database"""
    if not verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")

    try:
        season = get_current_season()
        stats = fetch_team_stats(season)

        if not stats:
            return {"success": False, "error": "No stats fetched"}

        conn = psycopg2.connect(DATABASE_URL)
        try:
            team_mapping = get_team_id_mapping(conn)
            result = upsert_stats(conn, stats, team_mapping)
        finally:
            conn.close()

        return {
            "success": True,
            "season": season,
            "teamsProcessed": len(stats),
            **result,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# For local testing
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
