-- Merge the legacy Play and Run treatment strategy into Scooter.
-- Existing records are preserved under the canonical Scooter value.
UPDATE public.casualty_treatments
SET treatment_strategy = 'scooter'
WHERE treatment_strategy = 'play_and_run';

ALTER TABLE public.casualty_treatments
  DROP CONSTRAINT IF EXISTS treatment_strategy_check;

ALTER TABLE public.casualty_treatments
  ADD CONSTRAINT treatment_strategy_check CHECK (
    treatment_strategy IN (
      'scoop_and_run',
      'scooter',
      'stay_and_play',
      'unknown'
    )
  );
