SELECT count(*) AS orphans FROM auth.users au
  LEFT JOIN public.users u ON u.id = au.id WHERE u.id IS NULL;