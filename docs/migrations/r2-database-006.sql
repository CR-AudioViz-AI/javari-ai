-- Migration for CR AudioViz AI platform
-- Description: Update schema for system architecture
-- Priority: 7
-- Date: 2023-10-03

BEGIN;

-- Create tables if they do not exist
CREATE TABLE IF NOT EXISTS audio_files (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audio_analysis (
    id SERIAL PRIMARY KEY,
    audio_file_id INT REFERENCES audio_files(id) ON DELETE CASCADE,
    analysis_result JSONB,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_audio_file_name ON audio_files(file_name);
CREATE INDEX IF NOT EXISTS idx_user_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_audio_analysis_file_id ON audio_analysis(audio_file_id);

COMMIT;

-- Committed by Javari
-- Task: r2-database-006
-- Executed live: false
