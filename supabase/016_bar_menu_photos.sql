-- Custom drink photos — promoter-uploaded image URL per bar menu item.
--
-- The 4 featured drinks (Suero, Suero con Mezcal, Cerveza, Michelada) get
-- their photos from /public/drinks via name match in featuredDrinks.js.
-- This column lets the promoter override that or attach a photo to a
-- custom item they added themselves.
--
-- Idempotent.

alter table bar_menu_items
  add column if not exists image_url text;

-- Public read, promoter-write storage bucket — create via Supabase dashboard
-- (Storage → New bucket → "bar-photos", public, no file-size limit set
-- here so we rely on the client to compress large uploads).
