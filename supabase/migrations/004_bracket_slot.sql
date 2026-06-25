ALTER TABLE games ADD COLUMN bracket_slot INTEGER;

-- Round of 32: assign official bracket position (0-15) so consecutive pairs feed
-- the correct Round of 16 game. Times are UTC (screenshots in BRT = UTC-3).
--
-- Slots 0-7  → left half  → R16[0-3] → QF 09/07 + 10/07 → SF 14/07
-- Slots 8-15 → right half → R16[4-7] → QF 11/07 + 11/07 → SF 15/07
UPDATE games SET bracket_slot = CASE
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-06-28 19:00:00' THEN 0   -- Canadá (28/06 16:00 BRT)
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-06-30 01:00:00' THEN 1   -- Marrocos (29/06 22:00 BRT)
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-06-29 20:00:00' THEN 2   -- Alemanha (29/06 17:30 BRT, 20:30 UTC truncates to 20)
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-06-30 21:00:00' THEN 3   -- 30/06 18:00 BRT
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-01 20:00:00' THEN 4   -- 01/07 17:00 BRT
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-02 00:00:00' THEN 5   -- Estados Unidos (01/07 21:00 BRT)
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-02 19:00:00' THEN 6   -- 02/07 16:00 BRT
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-02 23:00:00' THEN 7   -- 02/07 20:00 BRT
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-06-29 17:00:00' THEN 8   -- Brasil (29/06 14:00 BRT)
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-06-30 17:00:00' THEN 9   -- 30/06 14:00 BRT
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-01 01:00:00' THEN 10  -- México (30/06 22:00 BRT)
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-01 16:00:00' THEN 11  -- 01/07 13:00 BRT
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-03 03:00:00' THEN 12  -- Suíça (03/07 00:00 BRT)
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-04 01:00:00' THEN 13  -- 03/07 22:30 BRT (01:30 UTC truncates to 01)
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-03 18:00:00' THEN 14  -- 03/07 15:00 BRT
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-03 22:00:00' THEN 15  -- Argentina (03/07 19:00 BRT)
END
WHERE stage IN ('Round of 32', 'r32', 'last_32', 'LAST_32');

-- Round of 16: slots 2,3 and 6,7 are deliberately non-chronological so consecutive
-- pairing produces the correct Quarter-final matchups.
UPDATE games SET bracket_slot = CASE
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-04 17:00:00' THEN 0  -- 04/07 14:00 BRT → QF 09/07
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-04 21:00:00' THEN 1  -- 04/07 18:00 BRT → QF 09/07
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-07 00:00:00' THEN 2  -- 06/07 21:00 BRT → QF 10/07
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-06 19:00:00' THEN 3  -- 06/07 16:00 BRT → QF 10/07
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-05 20:00:00' THEN 4  -- 05/07 17:00 BRT → QF 11/07
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-06 00:00:00' THEN 5  -- 05/07 21:00 BRT → QF 11/07
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-07 20:00:00' THEN 6  -- 07/07 17:00 BRT → QF 11/07 22:00
  WHEN date_trunc('hour', match_date AT TIME ZONE 'UTC') = '2026-07-07 16:00:00' THEN 7  -- 07/07 13:00 BRT → QF 11/07 22:00
END
WHERE stage IN ('Round of 16', 'r16', 'last_16', 'LAST_16');
