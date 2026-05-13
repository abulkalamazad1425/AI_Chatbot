# AI Chatbot

AI Chatbot is a full-stack conversational AI application with user authentication, persistent chat history, and local large language model responses through Ollama. It provides a public home page, a login and registration experience, and a protected chat interface where users can talk to the assistant and save their conversation history.

## What the project does

The project is built to let users create an account, sign in, and chat with an AI assistant powered by a locally running Ollama model. Messages are sent from the frontend to a Node.js backend, which forwards them to Ollama and returns the generated response. Each user’s conversation is stored in MongoDB, so the chat history can be loaded again after refresh or future logins.

The app is split into three main user-facing pages:

- `home.html` for the landing page and product overview
- `login.html` for registration and login
- `index.html` for the main chat experience

## Features

- User registration and login
- JWT-based authentication
- Protected chat interface
- Ollama-backed AI responses
- MongoDB chat history per user
- Demo account for quick testing
- Responsive layout for desktop and mobile
- Light and dark theme support
- Separate landing page, auth page, and chat page

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose
- Authentication: JWT, bcrypt
- AI Model: Ollama with `llama3`
- HTTP client: `node-fetch`

## Project Structure

- `home.html` - Landing page
- `index.html` - Main chat page
- `login.html` - Authentication page
- `css/` - Styles for the home, login, and chat screens
- `js/auth.js` - Session and auth management
- `js/login.js` - Login and registration logic
- `js/main.js` - Chat application logic
- `config/api.js` - Frontend API configuration
- `server/server.js` - Express backend, auth routes, chat proxy, and history storage
- `server/package.json` - Backend dependencies and scripts

## Backend API

The backend exposes these routes:

- `GET /api/health` - Health check
- `POST /api/auth/register` - Create a new account
- `POST /api/auth/login` - Log in and receive a token
- `GET /api/auth/me` - Get the current user profile
- `POST /api/chat` - Send messages to Ollama
- `GET /api/history` - Load saved messages
- `POST /api/history/messages` - Save a message to history
- `DELETE /api/history` - Clear the current user’s history

## Requirements

Before running the app, make sure you have:

- Node.js installed
- MongoDB running locally or remotely
- Ollama installed and running locally
- A model available in Ollama, such as `llama3`

## Configuration

Create a `server/.env` file with these values:

```env
OLLAMA_URL=http://localhost:11434
MONGODB_URI=mongodb://localhost:27017/ai-chatbot
JWT_SECRET=your-secret-key
DEFAULT_MODEL=llama3
PORT=3000
```

The frontend is configured to use the backend proxy by default through `config/api.js`.

## Installation

From the project root:

```bash
cd server
npm install
```

## Running the Project

1. Start MongoDB.
2. Start Ollama with `ollama serve`.
3. Create the `server/.env` file.
4. Start the backend from the `server/` folder:

```bash
npm start
```

5. Open the app in your browser at `http://localhost:3000`.

## Demo Login

A demo account is seeded automatically for testing:

- Username: `demo`
- Password: `demo123`

## How It Works

1. The user registers or logs in from `login.html`.
2. The backend issues a JWT token and creates a chat history record.
3. The chat page sends messages to `/api/chat`.
4. The backend forwards the conversation to Ollama.
5. The generated reply is shown in the UI.
6. The conversation is saved in MongoDB so it can be restored later.

## Notes

- The app does not require external AI API keys.
- Ollama must be reachable at the URL configured in `server/.env`.
- MongoDB is required for authentication and history storage.
- If the backend is not running, the frontend cannot complete chat requests.

## Project Description

AI Chatbot is a self-hosted AI assistant platform designed for private, local model usage. It combines a polished frontend with secure authentication, conversation persistence, and a backend that bridges the browser and a local LLM. The result is a practical chatbot application that feels like a complete product rather than a simple demo.
