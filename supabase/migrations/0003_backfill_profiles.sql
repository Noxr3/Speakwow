-- Students who signed up before 0001 have no profile row: the trigger that
-- creates one only fires on new sign-ups, and the learning record, memory and
-- courses all hang off public.profiles. Safe to run again.
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;
