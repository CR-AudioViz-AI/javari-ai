-- Database Functions for Feature Request Voting
-- Creates increment and decrement functions for vote counts

-- Function to increment feature request votes
CREATE OR REPLACE FUNCTION increment_feature_votes(feature_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE feature_requests
  SET votes = votes + 1
  WHERE id = feature_id;
END;
$$;

-- Function to decrement feature request votes
CREATE OR REPLACE FUNCTION decrement_feature_votes(feature_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE feature_requests
  SET votes = GREATEST(votes - 1, 0)
  WHERE id = feature_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_feature_votes(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_feature_votes(UUID) TO service_role;
