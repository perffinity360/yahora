-- 1. Universities Table (To list where Yahora is available)
CREATE TABLE universities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'iiitk.ac.in', 'niet.co.in'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table (Extends Supabase's auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id UUID REFERENCES universities(id) ON DELETE RESTRICT,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products Table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE, -- Enforces isolation
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    image_urls TEXT[] NOT NULL, -- Array of image links
    status VARCHAR(50) DEFAULT 'available', -- 'available', 'sold'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Likes / Wishlist Table (For the Tinder swipe feature)
CREATE TABLE product_likes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id) -- A user can only like an item once
);

-- 5. Community Posts Table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE, -- Enforces isolation
    content VARCHAR(250) NOT NULL, -- Twitter-like limit
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Direct Messages Table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE, -- Enforces isolation
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Modifying users tables
ALTER TABLE users 
ADD COLUMN department VARCHAR(100),
ADD COLUMN year_of_study VARCHAR(20),
ADD COLUMN bio VARCHAR(250),
ADD COLUMN is_profile_complete BOOLEAN DEFAULT FALSE;

-- We also need to make full_name nullable initially because 
-- it won't be filled until the onboarding step.
ALTER TABLE users ALTER COLUMN full_name DROP NOT NULL;



-- Adding Course and Specialization tables in the database by creating separate master tables for them. Then, we will link them to the users table and remove the old department column.
-- 1. Create the master table for Courses
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE
);

-- 2. Create the master table for Specializations
CREATE TABLE specializations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE
);

-- 3. Update the users table to reflect the new structure
ALTER TABLE users
DROP COLUMN department, -- Remove the old field from our previous step
ADD COLUMN qualification VARCHAR(100), -- Storing the frontend string (e.g., 'Graduation')
ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
ADD COLUMN specialization_id UUID REFERENCES specializations(id) ON DELETE SET NULL;


-- Adding a Purchases Table to the Database
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 1. Add the new fields to the products table
ALTER TABLE products
ADD COLUMN location VARCHAR(255),
ADD COLUMN condition VARCHAR(50) DEFAULT 'Good',
ADD COLUMN views INT DEFAULT 0,
ADD COLUMN likes_count INT DEFAULT 0,
ADD COLUMN comments_count INT DEFAULT 0,
ADD COLUMN sold_to VARCHAR(255);

-- 2. Create a table for the Save/Wishlist feature
CREATE TABLE product_saves (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id)
);

-- 1. Create a table to store the metric
CREATE TABLE visitor_metrics (
    id INT PRIMARY KEY DEFAULT 1,
    view_count INT DEFAULT 0
);

-- 2. Insert the initial starting row
INSERT INTO visitor_metrics (id, view_count) VALUES (1, 0);

-- 3. Create a Remote Procedure Call (RPC) to safely increment the count
CREATE OR REPLACE FUNCTION increment_page_view()
RETURNS INT AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE visitor_metrics
  SET view_count = view_count + 1
  WHERE id = 1
  RETURNING view_count INTO new_count;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION update_product_likes_count()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- 2. Attach the Trigger to the product_likes table
DROP TRIGGER IF EXISTS trg_update_likes_count ON product_likes;
CREATE TRIGGER trg_update_likes_count
AFTER INSERT OR DELETE ON product_likes
FOR EACH ROW
EXECUTE FUNCTION update_product_likes_count();

-- =================================== Database Expansion for PDP and messaging========================================
-- Upgrade the messages Table
ALTER TABLE messages 
ADD COLUMN is_read BOOLEAN DEFAULT FALSE,
ADD COLUMN product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- Create the comments Table    
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE, -- Enforces isolation!
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- Allows nested replies
    upvotes INT DEFAULT 0,   -- Cached count for fast loading
    downvotes INT DEFAULT 0, -- Cached count for fast loading
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the comment_votes Table
CREATE TABLE comment_votes (
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vote_value INT CHECK (vote_value IN (1, -1)), -- Restricts value to either +1 or -1
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id) -- A user can only have one active vote per comment
);


-- Create the Database Functions & Triggers (RPC)
-- The Smart RPC (For the Frontend to call)
CREATE OR REPLACE FUNCTION toggle_comment_vote(p_comment_id UUID, p_user_id UUID, p_vote_value INT)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql;

-- The Auto-Counting Trigger
CREATE OR REPLACE FUNCTION update_comment_vote_counts()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Attach the trigger to the table
CREATE TRIGGER trg_update_comment_votes
AFTER INSERT OR UPDATE OR DELETE ON comment_votes
FOR EACH ROW
EXECUTE FUNCTION update_comment_vote_counts();

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION update_product_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE products SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0) WHERE id = OLD.product_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach the Trigger to the comments table
DROP TRIGGER IF EXISTS trg_update_comments_count ON comments;
CREATE TRIGGER trg_update_comments_count
AFTER INSERT OR DELETE ON comments
FOR EACH ROW
EXECUTE FUNCTION update_product_comments_count();


-- The Inbox RPC
CREATE OR REPLACE FUNCTION get_user_inbox(p_user_id UUID)
RETURNS TABLE (
  contact_id UUID,
  contact_name VARCHAR,
  contact_avatar TEXT,
  product_id UUID,
  product_title VARCHAR,
  product_image TEXT,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT
) AS $$
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
$$ LANGUAGE plpgsql;

-- Supabase Presence to track exactly when users are online across the site, and use an is_delivered database flag to power the ticks.
-- Adding the is_delivered flag to messages table
ALTER TABLE messages ADD COLUMN is_delivered BOOLEAN DEFAULT FALSE;

-- Allowing guests to increment views without giving them actual database permissions
DROP FUNCTION IF EXISTS increment_product_views(uuid);
CREATE OR REPLACE FUNCTION increment_product_views(product_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET views = COALESCE(views, 0) + 1
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix for the Storage 403 RLS Error
-- 1. Create a policy to ALLOW inserts to the products bucket for anyone authenticated
DROP POLICY IF EXISTS "Allow product uploads" ON storage.objects;
CREATE POLICY "Allow product uploads" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'products');
-- 2  . Create a policy to ALLOW viewing/selecting images
DROP POLICY IF EXISTS "Allow product image viewing" ON storage.objects;
CREATE POLICY "Allow product image viewing" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'products');

-- Cleanup Database Function (RPC)
CREATE OR REPLACE FUNCTION cleanup_demo_users()
RETURNS VOID AS $$
BEGIN
  -- Deletes any auth user with a demo email created more than 7 days ago
  DELETE FROM auth.users
  WHERE email LIKE 'guest_%@demo.yahora.com'
  AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;