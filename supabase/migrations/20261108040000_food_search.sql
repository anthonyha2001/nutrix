-- Ranked food search for the meal plan builder, recipe editor and library.
-- Every word typed must appear in the name or an alias. The practice's own
-- foods come first, then Lebanese dishes, then the closest names.
-- Runs as the caller, so row-level security decides what can be found.

create function public.search_foods(p_query text, p_category text default null, p_limit integer default 30)
returns setof public.foods
language sql stable set search_path = ''
as $$
  with q as (
    select lower(trim(coalesce(p_query, ''))) as text,
           array_remove(regexp_split_to_array(lower(trim(coalesce(p_query, ''))), '[\s,]+'), '') as words
  )
  select f.*
    from public.foods f, q
   where f.archived_at is null
     and (p_category is null or f.category = p_category)
     and (
       cardinality(q.words) = 0
       or not exists (
         select 1 from unnest(q.words) w
          where position(w in lower(f.name)) = 0
            and not exists (select 1 from unnest(f.aliases) a where position(w in lower(a)) > 0)
       )
     )
   order by (f.practice_id is not null) desc,
            (f.category = 'Lebanese dishes') desc,
            (lower(f.name) = q.text or q.text = any (select lower(a) from unnest(f.aliases) a)) desc,
            (lower(f.name) like q.text || '%') desc,
            extensions.word_similarity(q.text, lower(f.name)) desc,
            char_length(f.name)
   limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

revoke execute on function public.search_foods(text, text, integer) from public, anon;
grant execute on function public.search_foods(text, text, integer) to authenticated;
