select u.username, uni.name as my_college, u.university_id
from public.users u
join public.universities uni on uni.id = u.university_id
where u.id = '5e770303-06cf-4abb-8bc1-c3717b1afb50';
select university_id from public.users
where id = '5e770303-06cf-4abb-8bc1-c3717b1afb50';
select id, username, full_name, bio, university_id
from public.users
where id in (
  'd2b7b630-e9e4-45e0-a9b5-8c7eaab3242b',
  'b0000000-0000-4000-8000-000000000001'
);
select id, username, full_name from public.users
where id in (
  'd2b7b630-e9e4-45e0-a9b5-8c7eaab3242b',
  'b0000000-0000-4000-8000-000000000001'
);
update public.users set full_name = 'AKumar'
where id = 'd2b7b630-e9e4-45e0-a9b5-8c7eaab3242b';
select id, username, full_name from public.users
where id = 'd2b7b630-e9e4-45e0-a9b5-8c7eaab3242b';
update public.users set full_name = 'AKumar'
where id = 'd2b7b630-...' returning id, full_name;
await attack({ university_id: 'a0000000-0000-4000-8000-000000000001' });
select id, username, university_id from public.users
where id = 'd2b7b630-e9e4-45e0-a9b5-8c7eaab3242b';
select id, username from public.users
where id = 'd2b7b630-e9e4-45e0-a9b5-8c7eaab3242b';
select id, username, bio from public.users
where id = 'd2b7b630-e9e4-45e0-a9b5-8c7eaab3242b';