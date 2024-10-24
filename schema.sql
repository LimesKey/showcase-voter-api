-- Create users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slack_id TEXT UNIQUE, -- Ensure slack_id is unique
    hashed_slackid TEXT, -- Add hashed_slackid field
    username TEXT,
    vote_count INTEGER DEFAULT 0 -- Track the number of votes the user has cast
);

-- Create submissions table
CREATE TABLE submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id TEXT, -- Ensure submission_id is unique
    category TEXT,
    votes INTEGER DEFAULT 0 -- Track the number of votes for each submission
);

-- Create votes table to store votes per category
CREATE TABLE votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER, -- Reference the primary key id of submissions
    slack_id TEXT, -- Reference the slack_id of users
    category TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(submission_id) REFERENCES submissions(id), -- Reference the primary key id
    FOREIGN KEY(slack_id) REFERENCES users(slack_id) -- Reference the slack_id
);