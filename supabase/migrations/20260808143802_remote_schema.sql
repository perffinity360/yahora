-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

DROP EXTENSION pg_graphql;

CREATE ROLE supabase_privileged_role;

GRANT supabase_privileged_role TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

CREATE FUNCTION public.cleanup_demo_users()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
  -- Deletes any auth user with a demo email created more than 7 days ago
  DELETE FROM auth.users
  WHERE email LIKE 'guest_%@demo.yahora.com'
  AND created_at < NOW() - INTERVAL '7 days';
END;
$function$;

GRANT ALL ON FUNCTION public.cleanup_demo_users() TO anon;

GRANT ALL ON FUNCTION public.cleanup_demo_users() TO authenticated;

GRANT ALL ON FUNCTION public.cleanup_demo_users() TO service_role;

CREATE FUNCTION public.decrement_product_likes (
  p_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  AS $function$
BEGIN
  UPDATE products SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = p_id;
END;
$function$;

GRANT ALL ON FUNCTION public.decrement_product_likes(uuid) TO anon;

GRANT ALL ON FUNCTION public.decrement_product_likes(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.decrement_product_likes(uuid) TO service_role;

CREATE FUNCTION public.get_user_inbox (
  p_user_id uuid
)
  RETURNS TABLE (
    contact_id        uuid,
    contact_name      character varying,
    contact_avatar    text,
    product_id        uuid,
    product_title     character varying,
    product_image     text,
    last_message      text,
    last_message_time timestamp with time zone,
    unread_count      bigint
  )
  LANGUAGE plpgsql
  AS $function$
BEGIN
  RETURN QUERY
  WITH RankedMessages AS (
    SELECT
      m.id, m.content, m.created_at, m.is_read, m.product_id, m.sender_id, m.receiver_id,
      -- Identify who the "other" person in the chat is
      CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END as chat_partner_id,
      ROW_NUMBER() OVER (
        PARTITION BY m.product_id, CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END
        ORDER BY m.created_at DESC
      ) as rn
    FROM messages m
    WHERE m.sender_id = p_user_id OR m.receiver_id = p_user_id
  )
  SELECT
    u.id as contact_id,
    u.full_name as contact_name,
    u.avatar_url as contact_avatar,
    p.id as product_id,
    p.title as product_title,
    p.image_urls[1] as product_image, -- Grab just the first image
    rm.content as last_message,
    rm.created_at as last_message_time,
    (SELECT COUNT(*) FROM messages m2 
     WHERE m2.receiver_id = p_user_id 
     AND m2.sender_id = u.id 
     AND m2.product_id = p.id 
     AND m2.is_read = false) as unread_count
  FROM RankedMessages rm
  JOIN users u ON u.id = rm.chat_partner_id
  JOIN products p ON p.id = rm.product_id
  WHERE rm.rn = 1 -- Only get the latest message per conversation
  ORDER BY rm.created_at DESC;
END;
$function$;

GRANT ALL ON FUNCTION public.get_user_inbox(uuid) TO anon;

GRANT ALL ON FUNCTION public.get_user_inbox(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.get_user_inbox(uuid) TO service_role;

CREATE FUNCTION public.increment_page_view()
  RETURNS integer
  LANGUAGE plpgsql
  AS $function$
DECLARE
  new_count INT;
BEGIN
  UPDATE visitor_metrics
  SET view_count = view_count + 1
  WHERE id = 1
  RETURNING view_count INTO new_count;
  
  RETURN new_count;
END;
$function$;

GRANT ALL ON FUNCTION public.increment_page_view() TO anon;

GRANT ALL ON FUNCTION public.increment_page_view() TO authenticated;

GRANT ALL ON FUNCTION public.increment_page_view() TO service_role;

CREATE FUNCTION public.increment_product_likes (
  p_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  AS $function$
BEGIN
  UPDATE products SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = p_id;
END;
$function$;

GRANT ALL ON FUNCTION public.increment_product_likes(uuid) TO anon;

GRANT ALL ON FUNCTION public.increment_product_likes(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.increment_product_likes(uuid) TO service_role;

CREATE FUNCTION public.increment_product_views (
  product_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
  UPDATE products
  SET views = COALESCE(views, 0) + 1
  WHERE id = product_id;
END;
$function$;

GRANT ALL ON FUNCTION public.increment_product_views(uuid) TO anon;

GRANT ALL ON FUNCTION public.increment_product_views(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.increment_product_views(uuid) TO service_role;

CREATE FUNCTION public.toggle_comment_vote (
  p_comment_id uuid,
  p_user_id    uuid,
  p_vote_value integer
)
  RETURNS void
  LANGUAGE plpgsql
  AS $function$
DECLARE
    existing_vote INT;
BEGIN
    -- Check if a vote already exists for this user and comment
    SELECT vote_value INTO existing_vote FROM comment_votes
    WHERE comment_id = p_comment_id AND user_id = p_user_id;

    IF existing_vote IS NULL THEN
        -- No previous vote, insert it
        INSERT INTO comment_votes (comment_id, user_id, vote_value)
        VALUES (p_comment_id, p_user_id, p_vote_value);
    ELSIF existing_vote = p_vote_value THEN
        -- User clicked the same vote button again, meaning they want to remove their vote
        DELETE FROM comment_votes
        WHERE comment_id = p_comment_id AND user_id = p_user_id;
    ELSE
        -- User changed their vote (e.g., from upvote to downvote)
        UPDATE comment_votes
        SET vote_value = p_vote_value
        WHERE comment_id = p_comment_id AND user_id = p_user_id;
    END IF;
END;
$function$;

GRANT ALL ON FUNCTION public.toggle_comment_vote(uuid, uuid, integer) TO anon;

GRANT ALL ON FUNCTION public.toggle_comment_vote(uuid, uuid, integer) TO authenticated;

GRANT ALL ON FUNCTION public.toggle_comment_vote(uuid, uuid, integer) TO service_role;

CREATE FUNCTION public.update_comment_vote_counts()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  -- 1. Handling a brand new vote
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_value = 1 THEN
      UPDATE comments SET upvotes = upvotes + 1 WHERE id = NEW.comment_id;
    ELSE
      UPDATE comments SET downvotes = downvotes + 1 WHERE id = NEW.comment_id;
    END IF;
    
  -- 2. Handling a changed vote (Up to Down, or Down to Up)
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote_value = 1 AND NEW.vote_value = -1 THEN
      UPDATE comments SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = NEW.comment_id;
    ELSIF OLD.vote_value = -1 AND NEW.vote_value = 1 THEN
      UPDATE comments SET downvotes = downvotes - 1, upvotes = upvotes + 1 WHERE id = NEW.comment_id;
    END IF;
    
  -- 3. Handling a removed vote (Toggled off)
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_value = 1 THEN
      UPDATE comments SET upvotes = upvotes - 1 WHERE id = OLD.comment_id;
    ELSE
      UPDATE comments SET downvotes = downvotes - 1 WHERE id = OLD.comment_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$function$;

GRANT ALL ON FUNCTION public.update_comment_vote_counts() TO anon;

GRANT ALL ON FUNCTION public.update_comment_vote_counts() TO authenticated;

GRANT ALL ON FUNCTION public.update_comment_vote_counts() TO service_role;

CREATE FUNCTION public.update_product_comments_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE products SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0) WHERE id = OLD.product_id;
  END IF;
  RETURN NULL;
END;
$function$;

GRANT ALL ON FUNCTION public.update_product_comments_count() TO anon;

GRANT ALL ON FUNCTION public.update_product_comments_count() TO authenticated;

GRANT ALL ON FUNCTION public.update_product_comments_count() TO service_role;

CREATE FUNCTION public.update_product_likes_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Automatically add 1 when a like is inserted
    UPDATE products SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Automatically subtract 1 when a like is removed
    UPDATE products SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = OLD.product_id;
  END IF;
  RETURN NULL;
END;
$function$;

GRANT ALL ON FUNCTION public.update_product_likes_count() TO anon;

GRANT ALL ON FUNCTION public.update_product_likes_count() TO authenticated;

GRANT ALL ON FUNCTION public.update_product_likes_count() TO service_role;

CREATE TABLE public.comment_votes (
  comment_id uuid                     NOT NULL,
  user_id    uuid                     NOT NULL,
  vote_value integer,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.comment_votes
  ADD CONSTRAINT comment_votes_pkey PRIMARY KEY (comment_id, user_id);

ALTER TABLE public.comment_votes
  ADD CONSTRAINT comment_votes_vote_value_check CHECK (vote_value = ANY (ARRAY[1, '-1'::integer]));

GRANT ALL ON public.comment_votes TO anon;

GRANT ALL ON public.comment_votes TO authenticated;

GRANT ALL ON public.comment_votes TO service_role;

CREATE TRIGGER trg_update_comment_votes
  AFTER INSERT OR DELETE OR UPDATE ON public.comment_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_comment_vote_counts();

CREATE TABLE public.comments (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  product_id        uuid,
  user_id           uuid,
  university_id     uuid,
  content           text                     NOT NULL,
  parent_comment_id uuid,
  upvotes           integer                  DEFAULT 0,
  downvotes         integer                  DEFAULT 0,
  created_at        timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.comments
  ADD CONSTRAINT comments_pkey PRIMARY KEY (id);

ALTER TABLE public.comment_votes
  ADD CONSTRAINT comment_votes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;

GRANT ALL ON public.comments TO anon;

GRANT ALL ON public.comments TO authenticated;

GRANT ALL ON public.comments TO service_role;

CREATE TRIGGER trg_update_comments_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_comments_count();

CREATE TABLE public.courses (
  id   uuid                   DEFAULT gen_random_uuid() NOT NULL,
  name character varying(255) NOT NULL
);

ALTER TABLE public.courses
  ADD CONSTRAINT courses_name_key UNIQUE (name);

ALTER TABLE public.courses
  ADD CONSTRAINT courses_pkey PRIMARY KEY (id);

GRANT ALL ON public.courses TO anon;

GRANT ALL ON public.courses TO authenticated;

GRANT ALL ON public.courses TO service_role;

CREATE TABLE public.messages (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  sender_id     uuid,
  receiver_id   uuid,
  university_id uuid,
  content       text                     NOT NULL,
  created_at    timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  is_read       boolean                  DEFAULT false,
  product_id    uuid,
  is_delivered  boolean                  DEFAULT false
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

GRANT ALL ON public.messages TO anon;

GRANT ALL ON public.messages TO authenticated;

GRANT ALL ON public.messages TO service_role;

CREATE TABLE public.posts (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  author_id     uuid,
  university_id uuid,
  content       character varying(250)   NOT NULL,
  image_url     text,
  created_at    timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.posts
  ADD CONSTRAINT posts_pkey PRIMARY KEY (id);

GRANT ALL ON public.posts TO anon;

GRANT ALL ON public.posts TO authenticated;

GRANT ALL ON public.posts TO service_role;

CREATE TABLE public.product_likes (
  user_id    uuid                     NOT NULL,
  product_id uuid                     NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.product_likes
  ADD CONSTRAINT product_likes_pkey PRIMARY KEY (user_id, product_id);

GRANT ALL ON public.product_likes TO anon;

GRANT ALL ON public.product_likes TO authenticated;

GRANT ALL ON public.product_likes TO service_role;

CREATE TRIGGER trg_update_likes_count
  AFTER INSERT OR DELETE ON public.product_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_likes_count();

CREATE TABLE public.product_saves (
  user_id    uuid                     NOT NULL,
  product_id uuid                     NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.product_saves
  ADD CONSTRAINT product_saves_pkey PRIMARY KEY (user_id, product_id);

GRANT ALL ON public.product_saves TO anon;

GRANT ALL ON public.product_saves TO authenticated;

GRANT ALL ON public.product_saves TO service_role;

CREATE TABLE public.products (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  seller_id      uuid,
  university_id  uuid,
  title          character varying(255)   NOT NULL,
  description    text,
  price          numeric(10,2)            NOT NULL,
  category       character varying(100)   NOT NULL,
  image_urls     text[]                   NOT NULL,
  status         character varying(50)    DEFAULT 'available'::character varying,
  created_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  location       character varying(255),
  condition      character varying(50)    DEFAULT 'Good'::character varying,
  views          integer                  DEFAULT 0,
  likes_count    integer                  DEFAULT 0,
  comments_count integer                  DEFAULT 0,
  sold_to        character varying(255)
);

ALTER TABLE public.products
  ADD CONSTRAINT products_pkey PRIMARY KEY (id);

ALTER TABLE public.comments
  ADD CONSTRAINT comments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.product_likes
  ADD CONSTRAINT product_likes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.product_saves
  ADD CONSTRAINT product_saves_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

GRANT ALL ON public.products TO anon;

GRANT ALL ON public.products TO authenticated;

GRANT ALL ON public.products TO service_role;

CREATE TABLE public.purchases (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  buyer_id   uuid,
  product_id uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

GRANT ALL ON public.purchases TO anon;

GRANT ALL ON public.purchases TO authenticated;

GRANT ALL ON public.purchases TO service_role;

CREATE TABLE public.specializations (
  id   uuid                   DEFAULT gen_random_uuid() NOT NULL,
  name character varying(255) NOT NULL
);

ALTER TABLE public.specializations
  ADD CONSTRAINT specializations_name_key UNIQUE (name);

ALTER TABLE public.specializations
  ADD CONSTRAINT specializations_pkey PRIMARY KEY (id);

GRANT ALL ON public.specializations TO anon;

GRANT ALL ON public.specializations TO authenticated;

GRANT ALL ON public.specializations TO service_role;

CREATE TABLE public.universities (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name       character varying(255)   NOT NULL,
  domain     character varying(100)   NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.universities
  ADD CONSTRAINT universities_domain_key UNIQUE (DOMAIN);

ALTER TABLE public.universities
  ADD CONSTRAINT universities_pkey PRIMARY KEY (id);

ALTER TABLE public.comments
  ADD CONSTRAINT comments_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;

ALTER TABLE public.products
  ADD CONSTRAINT products_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;

GRANT ALL ON public.universities TO anon;

GRANT ALL ON public.universities TO authenticated;

GRANT ALL ON public.universities TO service_role;

CREATE TABLE public.users (
  id                  uuid                     NOT NULL,
  university_id       uuid,
  full_name           character varying(255),
  avatar_url          text,
  created_at          timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  year_of_study       character varying(20),
  bio                 character varying(250),
  is_profile_complete boolean                  DEFAULT false,
  qualification       character varying(100),
  course_id           uuid,
  specialization_id   uuid
);

ALTER TABLE public.users
  ADD CONSTRAINT users_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.users
  ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE public.comment_votes
  ADD CONSTRAINT comment_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.product_likes
  ADD CONSTRAINT product_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.product_saves
  ADD CONSTRAINT product_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.products
  ADD CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.users
  ADD CONSTRAINT users_specialization_id_fkey FOREIGN KEY (specialization_id) REFERENCES public.specializations(id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD CONSTRAINT users_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE RESTRICT;

GRANT ALL ON public.users TO anon;

GRANT ALL ON public.users TO authenticated;

GRANT ALL ON public.users TO service_role;

CREATE TABLE public.visitor_metrics (
  id         integer DEFAULT 1 NOT NULL,
  view_count integer DEFAULT 0
);

ALTER TABLE public.visitor_metrics
  ADD CONSTRAINT visitor_metrics_pkey PRIMARY KEY (id);

GRANT ALL ON public.visitor_metrics TO anon;

GRANT ALL ON public.visitor_metrics TO authenticated;

GRANT ALL ON public.visitor_metrics TO service_role;
