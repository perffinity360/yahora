select public.is_username_available('rahul..sharma');   -- expect: false
select public.is_username_available('rah.ul.sharma');   -- expect: true
select public.is_username_available('rahul._sharma');   -- expect: false
select public.is_username_available('rahul-_sharma');   -- expect: false
select public.is_username_available('rahul.sharma');    -- expect: true
select public.is_username_available('rahul_sharma');    -- expect: true