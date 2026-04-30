-- events.staff_pin — per-event PIN for the bar-staff queue gate.
--
-- Replaces the hardcoded '7777' fallback. Promoters set their own PIN
-- on the event management page. Null = no PIN set yet (the PinGate falls
-- back to '7777' for backward-compat until the promoter saves one).
--
-- Idempotent.

alter table events add column if not exists staff_pin text;
