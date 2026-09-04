select

  un.name,

  un.domain,

  count(distinct u.id)  as students,

  count(distinct p.id)  as products,

  count(distinct po.id) as posts

from public.universities un

left join public.users    u  on u.university_id  = un.id

left join public.products p  on p.university_id  = un.id

left join public.posts    po on po.university_id = un.id

group by un.name, un.domain

order by un.name;













select

  (select count(*) from auth.users)      as auth_users,

  (select count(*) from public.users)    as users,

  (select count(*) from public.products) as products,

  (select count(*) from public.posts)    as posts,

  (select count(*) from public.messages) as messages;