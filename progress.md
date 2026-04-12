Original prompt: remove clothing and gem visuals, rework base character body/head

Notes:
- Current scope: strip clothing and gem visual presentation while preserving enough gameplay systems to keep builds/tests stable.
- Removed clothing and armor gems from shared/client catalogs, raid loot pools, trader offers, and item balance data.
- Player rendering is being simplified to base body/head visuals driven by a shared visual definition; clothing overlay sprites are removed.
- Player body now uses separate idle/run 16x16 spritesheets, and head movement is driven by per-frame offsets from animationFlow.
- Player head now uses dynamic 1-pixel eyes from shared visual config; player eyes follow cursor vertically, and trader eyes track the player's vertical position.
- Armor gem runtime helpers are neutral no-ops so stale network fields do not affect combat.
- Verification: shared build, realtime tests, frontend build, and backend game-configs test pass.
