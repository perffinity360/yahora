-- supabase/seed.sql
-- Runs automatically after every `supabase db reset`.
-- Reference data only. Never real user data.

INSERT INTO universities (name, domain) VALUES
  ('IIITDM Kurnool',     'iiitk.ac.in'),
  ('NIET Greater Noida', 'niet.co.in')
ON CONFLICT (domain) DO NOTHING;

INSERT INTO courses (name) VALUES
  ('B.Tech'), ('M.Tech'), ('B.Des'), ('MBA'), ('PhD')
ON CONFLICT (name) DO NOTHING;

INSERT INTO specializations (name) VALUES
  ('Computer Science and Engineering'),
  ('Electronics and Communication Engineering'),
  ('Mechanical Engineering'),
  ('Design')
ON CONFLICT (name) DO NOTHING;

INSERT INTO visitor_metrics (id, view_count) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;