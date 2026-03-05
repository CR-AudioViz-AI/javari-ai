-- Add retry_count column to execution logs
ALTER TABLE javari_execution_logs 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add index for retry tracking
CREATE INDEX IF NOT EXISTS idx_execution_logs_retry_count 
ON javari_execution_logs(retry_count);

COMMENT ON COLUMN javari_execution_logs.retry_count IS 'Number of times this task was retried after failure';
