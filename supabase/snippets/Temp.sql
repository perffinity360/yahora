SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname ILIKE '%avatar%';