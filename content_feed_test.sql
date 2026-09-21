begin;

select plan(12);

insert into public.collections (id, name, subscription_key_hash, version, active, published_at)
values (
  '10000000-0000-0000-0000-000000000001',
  'Französisch 7b',
  encode(digest('abcdefghijklmnopqrstuvwxyzABCDEF', 'sha256'), 'hex'),
  3,
  true,
  '2026-09-20T10:00:00Z'
);

insert into public.vocab_lists (id, collection_id, name, description, version, status, updated_at)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Entwurf', '', 1, 'draft', '2026-09-19T10:00:00Z'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Unité 1', 'Schule', 2, 'published', '2026-09-20T09:00:00Z');

insert into public.vocab_items (id, list_id, french, german, example, image_url, position)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'secret', 'Entwurf', '', null, 0),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'bonjour', 'guten Tag', 'Bonjour !', null, 0),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'le livre', 'das Buch', 'Je lis.', null, 1);

set local role anon;

select is(
  public.get_published_collection('abcdefghijklmnopqrstuvwxyzABCDEF')->>'collectionId',
  '10000000-0000-0000-0000-000000000001',
  'a valid subscription key returns the collection'
);

select is(
  jsonb_array_length(public.get_published_collection('abcdefghijklmnopqrstuvwxyzABCDEF')->'lists'),
  1,
  'only published lists are returned'
);

select is(
  public.get_published_collection('abcdefghijklmnopqrstuvwxyzABCDEF')->'lists'->0->>'name',
  'Unité 1',
  'the published list is returned'
);

select is(
  jsonb_array_length(public.get_published_collection('abcdefghijklmnopqrstuvwxyzABCDEF')->'lists'->0->'items'),
  2,
  'published vocabulary items are returned'
);

select is(
  public.get_published_collection('abcdefghijklmnopqrstuvwxyzABCDEF')->'lists'->0->'items'->0->>'french',
  'bonjour',
  'items use stable position ordering'
);

select is(
  public.get_published_collection('abcdefghijklmnopqrstuvwxyzABCDEF') ? 'subscription_key_hash',
  false,
  'the subscription hash is never returned'
);

select ok(
  has_function_privilege('anon', 'public.get_published_collection(text)', 'execute'),
  'anon can execute the published content function'
);

select is(
  public.get_published_collection('wrong-key')::text,
  null::text,
  'a wrong subscription key returns null'
);

select throws_ok(
  'select * from public.collections',
  '42501',
  'permission denied for table collections',
  'anon cannot select collections directly'
);

select throws_ok(
  'select * from public.vocab_lists',
  '42501',
  'permission denied for table vocab_lists',
  'anon cannot select vocabulary lists directly'
);

select throws_ok(
  'select * from public.vocab_items',
  '42501',
  'permission denied for table vocab_items',
  'anon cannot select vocabulary items directly'
);

reset role;
update public.collections set active = false where id = '10000000-0000-0000-0000-000000000001';
set local role anon;

select is(
  public.get_published_collection('abcdefghijklmnopqrstuvwxyzABCDEF')::text,
  null::text,
  'an inactive collection returns null'
);

select * from finish();
rollback;
