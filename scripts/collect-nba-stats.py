#!/usr/bin/env python3
"""
NBA Advanced Stats Collector
Fetches team advanced stats from NBA.com via nba_api and stores in PostgreSQL.
"""

import os
import sys
import json
from datetime import datetime
from typing import Optional

import psycopg2
from psycopg2.extras import execute_values
from nba_api.stats.endpoints import leaguedashteamstats
from nba_api.stats.static import teams as nba_teams

# Database connection from environment
DATABASE_URL = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL or DIRECT_URL environment variable not set")
    sys.exit(1)


def get_current_season() -> str:
    """Get current NBA season string (e.g., '2024-25')"""
    today = datetime.now()
    year = today.year
    month = today.month
    # NBA season starts in October
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

    # Merge data by TEAM_ID
    results = []
    for _, row in traditional_df.iterrows():
        team_id = row["TEAM_ID"]
        team_name = row["TEAM_NAME"]

        # Find matching advanced stats
        adv_row = advanced_df[advanced_df["TEAM_ID"] == team_id]
        if adv_row.empty:
            continue
        adv_row = adv_row.iloc[0]

        results.append({
            "nba_team_id": int(team_id),
            "team_name": team_name,
            "season": season,
            # Offensive stats
            "off_rating": float(adv_row.get("OFF_RATING", 0)) if adv_row.get("OFF_RATING") else None,
            "pace": float(adv_row.get("PACE", 0)) if adv_row.get("PACE") else None,
            "fg_pct": float(row.get("FG_PCT", 0)) if row.get("FG_PCT") else None,
            "fg3_pct": float(row.get("FG3_PCT", 0)) if row.get("FG3_PCT") else None,
            "ft_pct": float(row.get("FT_PCT", 0)) if row.get("FT_PCT") else None,
            "ast_pct": float(adv_row.get("AST_PCT", 0)) if adv_row.get("AST_PCT") else None,
            "tov_pct": float(adv_row.get("TM_TOV_PCT", 0)) if adv_row.get("TM_TOV_PCT") else None,
            # Defensive stats
            "def_rating": float(adv_row.get("DEF_RATING", 0)) if adv_row.get("DEF_RATING") else None,
            "reb_pct": float(adv_row.get("REB_PCT", 0)) if adv_row.get("REB_PCT") else None,
            "dreb_pct": float(adv_row.get("DREB_PCT", 0)) if adv_row.get("DREB_PCT") else None,
            "oreb_pct": float(adv_row.get("OREB_PCT", 0)) if adv_row.get("OREB_PCT") else None,
            # Net rating
            "net_rating": float(adv_row.get("NET_RATING", 0)) if adv_row.get("NET_RATING") else None,
            # Per game stats
            "avg_pts": float(row.get("PTS", 0)) if row.get("PTS") else None,
            "avg_reb": float(row.get("REB", 0)) if row.get("REB") else None,
            "avg_ast": float(row.get("AST", 0)) if row.get("AST") else None,
            "avg_stl": float(row.get("STL", 0)) if row.get("STL") else None,
            "avg_blk": float(row.get("BLK", 0)) if row.get("BLK") else None,
            "avg_tov": float(row.get("TOV", 0)) if row.get("TOV") else None,
            # Raw data for future
            "raw_data": {
                "traditional": row.to_dict(),
                "advanced": adv_row.to_dict()
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

    # Create mapping by name (normalized)
    mapping = {}
    for row in rows:
        team_id, name, external_id = row
        # Normalize name for matching
        normalized = name.lower().strip()
        mapping[normalized] = team_id
        # Also map by common variations
        if external_id:
            mapping[external_id.lower()] = team_id

    return mapping


def normalize_team_name(nba_name: str) -> str:
    """Normalize NBA team name for matching"""
    # NBA API returns full names like "Los Angeles Lakers"
    # Our DB might have "Lakers" or "Los Angeles Lakers"
    return nba_name.lower().strip()


def upsert_stats(conn, stats: list[dict], team_mapping: dict[str, str]):
    """Insert or update team advanced stats"""
    cursor = conn.cursor()

    inserted = 0
    updated = 0
    skipped = 0

    for stat in stats:
        team_name = stat["team_name"]
        normalized = normalize_team_name(team_name)

        # Try to find team ID
        team_id = team_mapping.get(normalized)

        # Try partial match if full name doesn't work
        if not team_id:
            for db_name, db_id in team_mapping.items():
                if normalized.endswith(db_name) or db_name.endswith(normalized.split()[-1]):
                    team_id = db_id
                    break

        if not team_id:
            print(f"  WARNING: Could not find team: {team_name}")
            skipped += 1
            continue

        # Check if record exists
        cursor.execute("""
            SELECT id FROM "TeamAdvancedStats"
            WHERE "teamId" = %s AND "sportType" = 'BASKETBALL' AND season = %s
        """, (team_id, stat["season"]))
        existing = cursor.fetchone()

        if existing:
            # Update
            cursor.execute("""
                UPDATE "TeamAdvancedStats" SET
                    "offRating" = %s,
                    pace = %s,
                    "fgPct" = %s,
                    "fg3Pct" = %s,
                    "ftPct" = %s,
                    "astPct" = %s,
                    "tovPct" = %s,
                    "defRating" = %s,
                    "rebPct" = %s,
                    "drebPct" = %s,
                    "orebPct" = %s,
                    "netRating" = %s,
                    "avgPts" = %s,
                    "avgReb" = %s,
                    "avgAst" = %s,
                    "avgStl" = %s,
                    "avgBlk" = %s,
                    "avgTov" = %s,
                    "rawData" = %s,
                    "updatedAt" = NOW()
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
            # Insert
            cursor.execute("""
                INSERT INTO "TeamAdvancedStats" (
                    id, "teamId", "sportType", season,
                    "offRating", pace, "fgPct", "fg3Pct", "ftPct", "astPct", "tovPct",
                    "defRating", "rebPct", "drebPct", "orebPct",
                    "netRating", "avgPts", "avgReb", "avgAst", "avgStl", "avgBlk", "avgTov",
                    "rawData", "createdAt", "updatedAt"
                ) VALUES (
                    gen_random_uuid(), %s, 'BASKETBALL', %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
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

    print(f"Results: {inserted} inserted, {updated} updated, {skipped} skipped")
    return inserted, updated, skipped


def main():
    print("=" * 50)
    print("NBA Advanced Stats Collector")
    print(f"Started at: {datetime.now().isoformat()}")
    print("=" * 50)

    season = get_current_season()
    print(f"Current season: {season}")

    # Fetch stats from NBA.com
    stats = fetch_team_stats(season)

    if not stats:
        print("No stats fetched, exiting")
        sys.exit(1)

    # Connect to database
    print(f"Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)

    try:
        # Get team ID mapping
        team_mapping = get_team_id_mapping(conn)
        print(f"Found {len(team_mapping)} teams in database")

        # Upsert stats
        upsert_stats(conn, stats, team_mapping)

        print("=" * 50)
        print("Completed successfully!")
        print("=" * 50)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
