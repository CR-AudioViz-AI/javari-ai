# Javari AI - Database Migrations

This directory contains SQL migration files to set up the Javari AI database schema in Supabase.

## 📋 Quick Start

### Option 1: Run Complete Schema (Recommended)
1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/kteobfyferrukqeolofj/sql/new
2. Copy and paste the contents of `COMPLETE_SCHEMA.sql`
3. Click "Run" to execute
4. Verify all 9 tables were created

### Option 2: Run Migrations Sequentially
Run these files in order:
1. `001_core_tables.sql` - Creates projects, subprojects, conversations, messages
2. `002_advanced_tables.sql` - Creates work logs, build health, suggestions, reviews, dependencies

## 🗄️ Database Schema Overview

### Core Tables (Migration 001)
- **projects** - Main project registry
- **subprojects** - Sub-project hierarchy with parent linking
- **conversations** - Chat conversations with continuation support
- **conversation_messages** - Individual messages within conversations

### Advanced Tables (Migration 002)
- **work_logs** - Detailed work action logging
- **build_health_tracking** - Build monitoring and auto-fix tracking
- **smart_suggestions** - AI-generated improvement suggestions
- **code_review_queue** - Code review management
- **dependency_tracking** - Package dependency monitoring

## ✅ Verification

After running migrations, verify with:

```sql
-- Count tables
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'projects', 'subprojects', 'conversations', 'conversation_messages',
  'work_logs', 'build_health_tracking', 'smart_suggestions', 
  'code_review_queue', 'dependency_tracking'
);
-- Should return 9

-- Check sequences
SELECT COUNT(*) FROM information_schema.sequences
WHERE sequence_schema = 'public'
AND sequence_name LIKE 'seq_%';
-- Should return 8
```

## 🔐 Connection Details

- **URL:** https://kteobfyferrukqeolofj.supabase.co
- **Project ID:** kteobfyferrukqeolofj
- **Dashboard:** https://supabase.com/dashboard/project/kteobfyferrukqeolofj

## 🚨 Important Notes

1. **Idempotent:** All migrations use `IF NOT EXISTS` - safe to run multiple times
2. **Order Matters:** Run migrations in numerical order (001, 002, etc.)
3. **Rollback:** Each migration can be reversed by dropping the tables it creates
4. **Backup:** Always backup production data before running migrations

## 🔄 Rollback Instructions

To rollback all tables:

```sql
DROP TABLE IF EXISTS dependency_tracking CASCADE;
DROP TABLE IF EXISTS code_review_queue CASCADE;
DROP TABLE IF EXISTS smart_suggestions CASCADE;
DROP TABLE IF EXISTS build_health_tracking CASCADE;
DROP TABLE IF EXISTS work_logs CASCADE;
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS subprojects CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

DROP SEQUENCE IF EXISTS seq_conversation_id;
DROP SEQUENCE IF EXISTS seq_project_id;
DROP SEQUENCE IF EXISTS seq_subproject_id;
DROP SEQUENCE IF EXISTS seq_work_log_id;
DROP SEQUENCE IF EXISTS seq_build_health_id;
DROP SEQUENCE IF EXISTS seq_suggestion_id;
DROP SEQUENCE IF EXISTS seq_review_id;
DROP SEQUENCE IF EXISTS seq_dependency_id;

DROP TYPE IF EXISTS conversation_status;
DROP TYPE IF EXISTS project_status;
DROP TYPE IF EXISTS priority_level;
DROP TYPE IF EXISTS health_status;
```

## 📚 Schema Documentation

For detailed schema documentation, see: `JAVARI_COMPLETE_DATABASE_SCHEMA.sql` in the root directory.

---

**Last Updated:** October 27, 2025  
**Version:** 2.0.0  
**Author:** Roy Henderson, CEO, CR AudioViz AI
