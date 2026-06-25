-- Knockout advance pick prediction
ALTER TABLE predictions
  ADD COLUMN advance_pick TEXT CHECK (advance_pick IN ('home','away'));

-- Actual knockout winner (populated by sync-results cron)
ALTER TABLE games
  ADD COLUMN knockout_winner TEXT CHECK (knockout_winner IN ('home','away'));

-- Add advance bonus and rebuild total_points generated column to include it.
-- Single ALTER TABLE so the column is never absent between statements.
ALTER TABLE game_scores
  DROP COLUMN total_points,
  ADD COLUMN advance_bonus INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN total_points INTEGER GENERATED ALWAYS AS (base_points + odds_bonus + advance_bonus) STORED;
