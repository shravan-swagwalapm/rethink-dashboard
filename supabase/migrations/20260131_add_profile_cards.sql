-- Profile Cards Migration for Shareable URLs
-- Allows users to generate unique public URLs for their profile cards

-- ============================================
-- 1. Create profile_cards table
-- ============================================
CREATE TABLE IF NOT EXISTS profile_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE, -- Unique shareable identifier (e.g., 'abc123')
  is_active BOOLEAN DEFAULT true, -- Can deactivate cards
  view_count INTEGER DEFAULT 0, -- Track how many times viewed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Create indexes for performance
-- ============================================

-- Index for fast slug lookups (public access)
CREATE INDEX idx_profile_cards_slug ON profile_cards(slug) WHERE is_active = true;

-- Index for user lookups
CREATE INDEX idx_profile_cards_user_id ON profile_cards(user_id);

-- Partial unique index to ensure one active card per user
CREATE UNIQUE INDEX idx_unique_active_card_per_user ON profile_cards(user_id) WHERE is_active = true;

-- ============================================
-- 3. Enable Row Level Security
-- ============================================
ALTER TABLE profile_cards ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS Policies
-- ============================================

-- Users can view their own cards
CREATE POLICY "Users can view own profile cards"
  ON profile_cards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own cards
CREATE POLICY "Users can create own profile cards"
  ON profile_cards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own cards
CREATE POLICY "Users can update own profile cards"
  ON profile_cards FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Public can view active cards (for shareable URLs)
CREATE POLICY "Public can view active profile cards"
  ON profile_cards FOR SELECT
  TO anon
  USING (is_active = true);

-- ============================================
-- 5. Trigger for updated_at
-- ============================================
-- Note: update_updated_at_column() function already exists in 001_initial_schema.sql

CREATE TRIGGER update_profile_cards_updated_at
  BEFORE UPDATE ON profile_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. Function to generate unique slug
-- ============================================
CREATE OR REPLACE FUNCTION generate_profile_slug()
RETURNS TEXT AS $$
DECLARE
  new_slug TEXT;
  slug_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character random slug (base64 for URL-safe)
    -- Uses gen_random_bytes to generate cryptographically random bytes
    -- Then encodes to base64 and removes non-URL-safe characters
    new_slug := encode(gen_random_bytes(6), 'base64');
    new_slug := REPLACE(new_slug, '/', '');
    new_slug := REPLACE(new_slug, '+', '');
    new_slug := REPLACE(new_slug, '=', '');
    new_slug := LOWER(SUBSTRING(new_slug, 1, 8));

    -- Check if slug exists
    SELECT EXISTS(SELECT 1 FROM profile_cards WHERE slug = new_slug) INTO slug_exists;

    -- Exit loop if unique
    EXIT WHEN NOT slug_exists;
  END LOOP;

  RETURN new_slug;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Function to increment view count
-- ============================================
CREATE OR REPLACE FUNCTION increment_profile_card_views(card_slug TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE profile_cards
  SET view_count = view_count + 1
  WHERE slug = card_slug AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role for view counting
GRANT EXECUTE ON FUNCTION increment_profile_card_views(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION increment_profile_card_views(TEXT) TO authenticated;
