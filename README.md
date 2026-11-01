# GoodGather – Backend Server

This repository contains the backend of **GoodGather**, a social development events platform. It handles event data, user participation, and communication between the frontend and the database.

I built this backend using Node.js and Express.js, with MongoDB for storing application data. It also includes authentication verification to protect private API routes.

## Related Links

- **Live Website:** https://social-frontend-three-eta.vercel.app
- **Frontend Repository:** https://github.com/towhidul-dev-ai/social-development-events-platform
- **Backend Repository:** https://github.com/towhidul-dev-ai/social-development-server

## Features

- **Event Management:** Create, retrieve, update, and delete event information.
- **Upcoming Events:** Retrieve upcoming events for the frontend.
- **Event Details:** Get information about individual events.
- **Join Events:** Allow authenticated users to join events.
- **Joined Events:** Retrieve events joined by a user.
- **Duplicate Join Prevention:** Prevent users from joining the same event more than once.
- **Authentication Verification:** Verify authentication tokens before allowing access to protected routes.
- **MongoDB Integration:** Store and manage event and participation data.

## Technologies Used

- Node.js
- Express.js
- MongoDB
- Better Auth JWT
- JavaScript
- REST API
- Vercel

## Getting Started

Follow these steps to run the backend locally.

### 1. Clone the repository

```bash
git clone https://github.com/towhidul-dev-ai/social-development-server.git
```

### 2. Open the project folder

```bash
cd social-development-server
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root and add the environment variables required by your server configuration.

For example:

```env
PORT=8000
MONGODB_URL=your_mongodb_connection_string
CLIENT_URL=http://localhost:3000
```

Add any additional authentication or deployment variables required by your code. Never commit real passwords, database credentials, or secret keys to GitHub.

### 5. Start the server

Use the start command configured in your `package.json`. For example:

```bash
npm start
```

For development, if you have a development script:

```bash
npm run dev
```

The local backend will be available at:

```text
http://localhost:8000
```

## API Overview

The backend provides API functionality for:

| Feature | Description |
|---|---|
| Events | Retrieve and manage events |
| Upcoming Events | Get future events |
| Event Details | Retrieve a specific event |
| Join Events | Register participation |
| Joined Events | Get a user's joined events |
| Authentication | Protect private API operations |

Refer to the server source code for the exact endpoint paths and request formats.

## Deployment

The backend is deployed using Vercel.

**Backend URL:** https://social-backend-dbbu01o1p-3-star1.vercel.app

The frontend communicates with this backend through API requests. Environment variables are configured separately for local development and production.

---

**Developed with care by Towhidul Islam Shahed.**
