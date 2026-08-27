# Media Vault & Document Manager

A backend-focused cloud file management application built with Node.js, Express, MongoDB, JWT and AWS S3.

## Features

- User registration and login
- bcrypt password hashing
- JWT authentication
- Private AWS S3 bucket
- Short-lived S3 presigned upload URLs
- Direct browser-to-S3 uploads
- MongoDB file metadata
- Folder and nested-folder support
- 500 MB per-user quota
- File type and size validation
- Presigned download URLs
- Soft delete / Trash
- Restore files
- Permanent S3 deletion
- 30-day background cleanup job
- HTML/CSS/JavaScript frontend

## Architecture

Browser -> Express API -> MongoDB
             |
             -> presigned URL
Browser -----------------> private S3

The Node.js server does not proxy the actual file bytes during a normal upload.

## Setup

### 1. Backend

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and fill in MongoDB and AWS values.

```bash
npm run dev
```

Backend runs on `http://localhost:5000`.

### 2. Frontend

From the project root:

```bash
cd frontend
python -m http.server 5500
```

Open:

`http://localhost:5500`

You can also use VS Code Live Server.

### 3. MongoDB

Create a MongoDB database and put the connection string in `MONGO_URI`.

### 4. AWS S3

Create a private S3 bucket.

Create an IAM user/role with only the S3 permissions needed by this application. Do not commit AWS credentials.

For local browser uploads, configure the S3 bucket CORS to allow your frontend origin and the PUT/GET methods you use. Example development CORS:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5500"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Keep the bucket private; do not disable S3 Block Public Access just to make this project work.

## Upload flow

1. Browser sends file name, MIME type, size and folder ID to `/api/files/upload-url`.
2. JWT middleware authenticates the user.
3. Backend validates file type, size, folder ownership and quota.
4. Backend creates a unique S3 key.
5. Backend generates a presigned PUT URL valid for 10 minutes.
6. Browser uploads the actual file directly to S3.
7. Browser calls `/api/files/complete`.
8. Backend stores metadata in MongoDB and updates `storageUsed`.

## Important MVP limitation

Normal uploads are limited to 100 MB. Multipart upload is intentionally not included in this MVP. It can be added as the next advanced module for files larger than 100 MB.

## API summary

### Auth
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`

### Folders
- POST `/api/folders`
- GET `/api/folders?parentFolder=<id>`
- DELETE `/api/folders/:id`

### Files
- POST `/api/files/upload-url`
- POST `/api/files/complete`
- GET `/api/files`
- GET `/api/files/:id/download`
- DELETE `/api/files/:id`
- GET `/api/files/trash`
- PATCH `/api/files/:id/restore`
- DELETE `/api/files/:id/permanent`

## GitHub safety

Never commit:

- `.env`
- AWS access keys
- AWS secret keys
- MongoDB credentials
- JWT secret
- `node_modules`

Commit `.env.example` instead.

## Interview explanation

The main engineering problem is avoiding the application server becoming a file-transfer bottleneck. The API authenticates and authorizes the user, validates quota and file information, then issues a short-lived presigned S3 URL. The browser uploads directly to S3 while Node.js handles control-plane operations and metadata.