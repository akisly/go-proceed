-- 0022: correction from the pre-landing review of v0.1-M2-A.
--
-- Additive. Adds one column to public.valuation_allocations. 0015-0021 are
-- applied history and are not edited.
--
-- Why: a negative correction reduced a root's allocation in proportion to the
-- root's TOTAL quantity, including any over-contract portion that never
-- received money. Money was destroyed.
--
-- Worked example (contract quantity 4, pool 400):
--   root A records +3  -> carves 300, remaining pool 100, remaining quantity 1
--   root B records +3  -> only 1 unit is within contract, carves the last 100
--   root B corrects -2 -> shrink(100, 1, 3) = 33, so 67 is returned to the pool
--   performed is still 4, so remaining quantity is 0 and that 67 can never be
--   allocated again. It is simply gone.
--
-- The fix needs a fact the schema did not carry: how much of a root's quantity
-- actually earned money. It is not derivable after the fact, because each carve
-- takes from the pool REMAINING at that moment, so money-per-unit differs
-- between carves and cannot be inverted.
--
-- With it, a reduction consumes the root's unfunded quantity first and only
-- then eats into funded quantity, which is what "return what this root actually
-- received" means. In the example the -2 lands entirely on unfunded quantity,
-- B keeps its 100, and the pool stays fully allocated.
--
-- Rollback (dev only): drop the column.

alter table public.valuation_allocations
  add column funded_quantity numeric(20,6) not null default 0;

comment on column public.valuation_allocations.funded_quantity is
  'The part of this slice''s quantity that drew money from the work-item pool. '
  'Differs from quantity when the slice crosses the contract quantity: the '
  'over-contract remainder is recorded as performed but is not funded, and a '
  'later correction must not pretend it was.';
