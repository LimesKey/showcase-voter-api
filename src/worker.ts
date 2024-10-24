import { ExportedHandler } from '@cloudflare/workers-types';

export interface Env {
    DB: D1Database;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Handle vote submission
        if (url.pathname === '/vote' && request.method === 'POST') {
            console.log('Received POST request to /vote');

            try {
                // Parse the request body
                const { submissionId, slackID, hashedSlackID, category } = await request.json() as { 
                    submissionId: string; 
                    slackID: string; 
                    hashedSlackID: string;
                    category: string; 
                };

                console.log(`Parsed request body: submissionId=${submissionId}, slackID=${slackID}, hashedSlackID=${hashedSlackID}, category=${category}`);

                // Ensure the user exists
                const user = await ensureUserExists(env.DB, slackID, hashedSlackID) as { vote_count: number } | null;
                if (!user) {
                    const message = `Failed to ensure user exists: slackID=${slackID}`;
                    console.error(message);
                    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }
                console.log(`User exists or created: slackID=${slackID}`);

                // Check if the user has reached the maximum vote count
                if (user.vote_count >= 3) {
                    const message = `User ${slackID} has reached the maximum vote count of 3`;
                    console.warn(message);
                    return new Response(JSON.stringify({ error: message }), { status: 409, headers: { 'Content-Type': 'application/json' } });
                }

                // Ensure the submission exists
                const submission = await ensureSubmissionExists(env.DB, submissionId, category);
                if (!submission) {
                    const message = `Failed to ensure submission exists: submissionId=${submissionId}, category=${category}`;
                    console.error(message);
                    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }
                console.log(`Submission exists or created: submissionId=${submissionId}, category=${category}`);

                // Check if the user has already voted for this category's submission
                const hasVoted = await checkIfVoted(env.DB, submission.id as number, slackID, category);
                if (hasVoted) {
                    const message = `User ${slackID} has already voted for submission ${submissionId} in category ${category}`;
                    console.warn(message);
                    return new Response(JSON.stringify({ error: message }), { status: 409, headers: { 'Content-Type': 'application/json' } });
                }

                // Register the vote and update counts
                await submitVote(env.DB, submission.id as number, slackID, category);
                console.log(`Vote recorded: submissionId=${submissionId}, slackID=${slackID}, category=${category}`);

                // Respond with success
                return new Response(JSON.stringify({ success: 'Vote submitted successfully' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

            } catch (error) {
                console.error('Error processing vote submission:', error);
                return new Response(JSON.stringify({ error: 'Failed to submit vote' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        console.warn(`Unknown request: ${url.pathname} [${request.method}]`);
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
} satisfies ExportedHandler<Env>;

/**
 * Ensures the submission exists in the database, creating it if it doesn't.
 */
async function ensureSubmissionExists(tx: D1Database, submissionId: string, category: string) {
    console.log(`Checking if submission exists: submissionId=${submissionId}, category=${category}`);

    const submission = await tx.prepare(
        `SELECT * FROM submissions WHERE submission_id = ? AND category = ?`
    )
    .bind(submissionId, category)
    .first();

    // If the submission does not exist, attempt to create it
    if (!submission) {
        console.log(`Submission not found, creating a new one: submissionId=${submissionId}, category=${category}`);

        try {
            await tx.prepare(
                `INSERT INTO submissions (submission_id, category, votes) VALUES (?, ?, 0)`
            )
            .bind(submissionId, category)
            .run();
        } catch (error) {
            if ((error as any).code === 'SQLITE_CONSTRAINT') {
                console.warn(`Submission already exists due to concurrent insertion: submissionId=${submissionId}, category=${category}`);
                // Return the existing submission again
                return await tx.prepare(
                    `SELECT * FROM submissions WHERE submission_id = ? AND category = ?`
                )
                .bind(submissionId, category)
                .first();
            } else {
                throw error; // Rethrow unexpected errors
            }
        }

        // Return the newly created submission
        return await tx.prepare(
            `SELECT * FROM submissions WHERE submission_id = ? AND category = ?`
        )
        .bind(submissionId, category)
        .first();
    }

    return submission; // Submission exists
}

/**
 * Ensures the user exists in the database, creating them if they don't.
 */
async function ensureUserExists(tx: D1Database, slackID: string, hashedSlackID: string) {
    console.log(`Checking if user exists: slackID=${slackID}`);

    const user = await tx.prepare(
        `SELECT * FROM users WHERE slack_id = ?`
    )
    .bind(slackID)
    .first();

    if (!user) {
        console.log(`User not found, creating a new user: slackID=${slackID}`);

        try {
            await tx.prepare(
                `INSERT INTO users (slack_id, hashed_slackid, username, vote_count) VALUES (?, ?, ?, 0)`
            )
            .bind(slackID, hashedSlackID, `user_${slackID}`) // Default username format
            .run();
        } catch (error) {
            if ((error as any).code === 'SQLITE_CONSTRAINT') {
                console.warn(`User already exists: slackID=${slackID}`);
            } else {
                throw error; // Rethrow unexpected errors
            }
        }

        // Fetch the user again to ensure we have the latest info
        return await tx.prepare(
            `SELECT * FROM users WHERE slack_id = ?`
        )
        .bind(slackID)
        .first();
    }

    return user; // User exists
}

/**
 * Checks if the user has already voted for the submission in the given category.
 */
async function checkIfVoted(tx: D1Database, submissionId: number, slackID: string, category: string) {
    console.log(`Checking if user has already voted: submissionId=${submissionId}, slackID=${slackID}, category=${category}`);

    const vote = await tx.prepare(
        `SELECT * FROM votes WHERE submission_id = ? AND slack_id = ? AND category = ?`
    )
    .bind(submissionId, slackID, category)
    .first();

    return !!vote; // Return true if the vote exists
}

/**
 * Registers the vote, updates the vote count for the submission and user.
 */
async function submitVote(tx: D1Database, submissionId: number, slackID: string, category: string) {
    console.log(`Submitting vote: submissionId=${submissionId}, slackID=${slackID}, category=${category}`);

    // Insert the vote
    await tx.prepare(
        `INSERT INTO votes (submission_id, slack_id, category) VALUES (?, ?, ?)`
    )
    .bind(submissionId, slackID, category)
    .run();

    // Update submission vote count
    await tx.prepare(
        `UPDATE submissions SET votes = votes + 1 WHERE id = ?`
    )
    .bind(submissionId)
    .run();

    console.log(`Submission vote count updated: submissionId=${submissionId}, category=${category}`);

    // Update user vote count
    await tx.prepare(
        `UPDATE users SET vote_count = vote_count + 1 WHERE slack_id = ?`
    )
    .bind(slackID)
    .run();

    console.log(`User vote count updated: slackID=${slackID}`);
}