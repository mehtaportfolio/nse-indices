# Repository Guidelines

## Project Structure & Module Organization
This project is a Node.js-based automation service that fetches index data from the National Stock Exchange (NSE) and updates a Google Sheet.

- **server.js**: The main entry point. It runs an Express server that handles health checks, manual triggers, and schedules the index update job using `node-cron`. It includes a `isMarketOpen()` check to ensure updates only occur during IST market hours (9:15 AM - 3:30 PM, Mon-Fri).
- **updateIndices.js**: Contains the core logic for fetching index data from the NSE API and performing batch updates to a Google Sheet via the Google Sheets API.
- **test.js**: A standalone script for testing the data fetching and processing logic.
- **all.js**: A utility script for broader data operations.
- **.zencoder/ & .zenflow/**: Contain workflow definitions for Zencoder and Zenflow.

## Build, Test, and Development Commands
The project uses standard `npm` scripts and manual node commands for execution.

- **Start Server**: `npm start`
- **Development Mode**: `npm run dev` (uses `nodemon`)
- **Manual Index Update**: `node updateIndices.js`
- **Run Tests**: `node test.js`

## Coding Style & Naming Conventions
- **Module System**: Uses **CommonJS** (`require` and `module.exports`).
- **Asynchronous Code**: Prefers `async/await` for API calls and file operations.
- **Configuration**: Uses `.env` for environment variables (managed via `dotenv`).
- **Date/Time**: All market-related time logic is pinned to the `Asia/Kolkata` time zone.

## Testing Guidelines
Testing is performed via the `test.js` file. It validates the connection to the NSE API and the data mapping logic before it is committed to the Google Sheet.

## Commit & Pull Request Guidelines
Commit messages should be concise and descriptive. Given the early stage of the repository, follow standard professional conventions (e.g., "fix: update nse api headers", "feat: add support for new index").
