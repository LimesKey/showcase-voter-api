# Cloudflare Wrangler API Program

This document provides instructions and usage examples for the Cloudflare Wrangler API Program.

## Table of Contents
- [Cloudflare Wrangler API Program](#cloudflare-wrangler-api-program)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Setup](#setup)
  - [API Endpoints](#api-endpoints)
    - [Submit Vote](#submit-vote)
      - [Request Body](#request-body)
      - [Response](#response)
  - [Database Schema](#database-schema)
    - [Users Table](#users-table)
    - [Submissions Table](#submissions-table)
    - [Votes Table](#votes-table)
  - [Error Handling](#error-handling)
    - [Example Error Response](#example-error-response)

## Introduction

This API allows users to submit votes for different submissions. It ensures that users and submissions exist in the database and handles vote counting.

## Setup

1. **Install Dependencies**:
    ```sh
    pnpm install
    ```

2. **Build the Project**:
    ```sh
    pnpm run build
    ```

3. **Start the Development Server**:
    ```sh
    pnpm run dev
    ```

## API Endpoints

### Submit Vote

- **Endpoint**: `/vote`
- **Method**: `POST`
- **Description**: Submits a vote for a specific submission and category.

#### Request Body

```json
{
  "submissionId": "string",
  "slackID": "string",
  "hashedSlackID": "string",
  "category": "string"
}
```

#### Response

- **Success**: 
    - **Status**: `200 OK`
    - **Body**:
        ```json
        {
          "success": "Vote submitted successfully"
        }
        ```
- **Errors**:
    - **Status**: `409 Conflict`
        ```json
        {
          "error": "User {slackID} has reached the maximum vote count of 3"
        }
        ```
    - **Status**: `409 Conflict`
        ```json
        {
          "error": "User {slackID} has already voted for submission {submissionId} in category {category}"
        }
        ```
    - **Status**: `500 Internal Server Error`
        ```json
        {
          "error": "Failed to submit vote"
        }
        ```

## Database Schema

### Users Table

| Column       | Type    | Description                  |
|--------------|---------|------------------------------|
| slack_id     | TEXT    | Unique identifier for the user|
| hashed_slackid | TEXT  | Hashed Slack ID              |
| username     | TEXT    | Username of the user         |
| vote_count   | INTEGER | Number of votes cast by the user |

### Submissions Table

| Column         | Type    | Description                  |
|----------------|---------|------------------------------|
| submission_id  | TEXT    | Unique identifier for the submission |
| category       | TEXT    | Category of the submission   |
| votes          | INTEGER | Number of votes for the submission |

### Votes Table

| Column         | Type    | Description                  |
|----------------|---------|------------------------------|
| submission_id  | INTEGER | ID of the submission         |
| slack_id       | TEXT    | ID of the user               |
| category       | TEXT    | Category of the vote         |

## Error Handling

Errors are returned with appropriate HTTP status codes and a JSON body containing the error message.

### Example Error Response

```json
{
  "error": "User {slackID} has reached the maximum vote count of 3"
}
```

Ensure to handle errors gracefully in your client application by checking the status codes and displaying relevant messages to the user.