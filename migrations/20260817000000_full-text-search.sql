-- Full-text search for marketplace listings and compliance rules.
-- Usage: SELECT * FROM marketplace_listings WHERE search_vector @@ websearch_to_tsquery('simple', 'ceylon cinnamon');

alter table public.marketplace_listings
  add column if not exists search_vector tsvector;

alter table public.compliance_rules
  add column if not exists search_vector tsvector;

create index if not exists marketplace_listings_search_idx
  on public.marketplace_listings using gin (search_vector);

create index if not exists compliance_rules_search_idx
  on public.compliance_rules using gin (search_vector);

create or replace function public.marketplace_listings_search_trigger() returns trigger
language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'B');
  return new;
end;
$$;

create or replace function public.compliance_rules_search_trigger() returns trigger
language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.rule_type, '')), 'C');
  return new;
end;
$$;

drop trigger if exists marketplace_listings_search on public.marketplace_listings;
create trigger marketplace_listings_search
  before insert or update on public.marketplace_listings
  for each row execute function public.marketplace_listings_search_trigger();

drop trigger if exists compliance_rules_search on public.compliance_rules;
create trigger compliance_rules_search
  before insert or update on public.compliance_rules
  for each row execute function public.compliance_rules_search_trigger();

-- Backfill existing rows
update public.marketplace_listings set search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B');

update public.compliance_rules set search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(rule_type, '')), 'C');
