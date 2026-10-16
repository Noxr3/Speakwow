-- Indexed substring search works for both Chinese and English. Catalogue
-- requests return only a page; unit content is loaded for the active course.
create extension if not exists pg_trgm with schema extensions;
alter table public.courses add column search_text text generated always as (
  lower(title || ' ' || coalesce(description, '') || ' ' || subject || ' ' ||
        coalesce(publisher, '') || ' ' || coalesce(region, ''))
) stored;
create index courses_catalog_search on public.courses using gin (search_text extensions.gin_trgm_ops);
create index courses_catalog_order on public.courses (title, id);
