SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('reserved_usernames','username_history','auth_attempts');