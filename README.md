# Dealbreaker API

The backend service for Dealbreaker, a dating app that helps users track and manage relationships by identifying and monitoring potential red flags and dealbreakers.

## Overview

Dealbreaker allows users to:
- Create and manage profiles
- Record relationship "flags" with customizable severity levels
- Define personal dealbreakers for potential partners
- Track relationship history
- Upload profile images

## Tech Stack

- **Runtime**: Node.js (v14+)
- **Framework**: Express.js
- **Database**: MongoDB (Atlas)
- **Authentication**: JWT, Passport.js with Google OAuth integration
- **File Storage**: AWS S3

## Project Structure

```
dealbreaker-backend/
├── config/          # Configuration files (passport, etc.)
├── middleware/      # Express middleware
├── models/          # Mongoose data models
│   ├── User.js      # User account data
│   ├── Profile.js   # User profile information
│   ├── Flag.js      # Relationship flags/issues
│   ├── FlagHistory.js # History of relationship flags
│   └── Dealbreaker.js # User's personal dealbreakers
├── routes/          # API endpoints
│   ├── auth.js      # Authentication routes
│   ├── dealbreaker.js # Dealbreaker management
│   ├── flagHistory.js # Flag history management
│   ├── upload.js    # File upload handling
│   └── user.js      # User profile management
├── .env             # Environment variables (not in repo)
├── server.js        # Main application entry point
└── package.json     # Project dependencies
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create a new user account
- `POST /api/auth/login` - Log in and get JWT token
- `GET /api/auth/google` - Google OAuth authentication

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

### Flag Management
- `GET /api/flagHistory` - Get all flags for a user
- `POST /api/flagHistory` - Create a new flag
- `PUT /api/flagHistory/:id` - Update an existing flag
- `DELETE /api/flagHistory/:id` - Delete a flag

### Dealbreaker Management
- `POST /api/dealbreaker/get-dealbreakers` - Get user's dealbreakers
- `POST /api/dealbreaker/add-dealbreaker` - Add/update dealbreakers

### File Upload
- `POST /api/upload` - Upload files to AWS S3

## Getting Started

### Prerequisites
- Node.js 14+
- MongoDB Atlas account
- AWS S3 bucket (for file uploads)

### Installation

1. Clone the repository
   ```
   git clone https://github.com/your-username/dealbreaker-backend.git
   cd dealbreaker-backend
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=4000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   
   # AWS S3 Configuration
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=your_aws_region
   S3_BUCKET=your_s3_bucket_name
   
   # Google OAuth (optional)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
   ```

4. Start the development server
   ```
   npm run dev
   ```

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2025 Jace Galloway 