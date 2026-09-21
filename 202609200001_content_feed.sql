create extension if not exists pgcrypto with schema extensions;

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  subscription_key_hash text not null unique,
  version bigint not null default 1 check (version > 0),
  active boolean not null default true,
  published_at timestamptz not null default now()
);

create table public.vocab_lists (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  version bigint not null default 1 check (version > 0),
  status text not null check (status in ('draft', 'published', 'withdrawn')),
  updated_at timestamptz not null default now()
);

create index vocab_lists_collection_id_idx on public.vocab_lists(collection_id);

create table public.vocab_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.vocab_lists(id) on delete cascade,
  french text not null check (length(btrim(french)) > 0),
  german text not null check (length(btrim(german)) > 0),
  example text not null default '',
  image_url text,
  position integer not null check (position >= 0),
  unique (list_id, position)
);

create index vocab_items_list_id_idx on public.vocab_items(list_id);

alter table public.collections enable row level security;
alter table public.vocab_lists enable row level security;
alter table public.vocab_items enable row level security;

revoke all on table public.collections from anon, authenticated;
revoke all on table public.vocab_lists from anon, authenticated;
revoke all on table public.vocab_items from anon, authenticated;

create or replace function public.get_published_collection(p_subscription_key text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'collectionId', c.id,
    'version', c.version,
    'publishedAt', c.published_at,
    'lists', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'name', l.name,
          'description', l.description,
          'version', l.version,
          'updatedAt', l.updated_at,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', i.id,
                'listId', i.list_id,
                'french', i.french,
                'german', i.german,
                'example', i.example,
                'imageUrl', i.image_url
              ) order by i.position, i.id
            )
            from public.vocab_items i
            where i.list_id = l.id
          ), '[]'::jsonb)
        ) order by l.updated_at, l.id
      )
      from public.vocab_lists l
      where l.collection_id = c.id
        and l.status = 'published'
    ), '[]'::jsonb)
  )
  from public.collections c
  where c.active = true
    and c.subscription_key_hash = encode(extensions.digest(p_subscription_key, 'sha256'), 'hex')
  limit 1;
$$;

revoke all on function public.get_published_collection(text) from public;
grant execute on function public.get_published_collection(text) to anon, authenticated;
