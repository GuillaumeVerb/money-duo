-- Lien optionnel vers une preuve (Drive, photo, etc.) — pas de stockage fichier côté app.
alter table public.expenses
  add column if not exists attachment_url text;

comment on column public.expenses.attachment_url is
  'URL optionnelle (ticket, capture, lien cloud) — utile pour s''y retrouver à deux.';
