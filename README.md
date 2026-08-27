# 🔐 Media Vault & Document Manager

A secure and performance-oriented cloud file management application built using **Node.js, Express.js, MongoDB, JWT and AWS S3**.

The application allows users to securely upload, organize, download and delete files while keeping the actual file transfer away from the Node.js server using **AWS S3 Presigned URLs**.

---

## 🚀 Project Overview

Traditional file upload architecture sends the entire file through the backend:

```text
Client
  ↓
Node.js / Express
  ↓
Storage

For large files, this can increase server memory usage, bandwidth consumption and processing overhead.

Media Vault uses a more efficient architecture:

                ┌───────────────┐
                │    Browser    │
                └───────┬───────┘
                        │
                 JWT Authentication
                        │
                        ▼
                ┌───────────────┐
                │ Node.js API   │
                │   Express     │
                └───────┬───────┘
                        │
                Validate user,
                quota & file
                        │
                        ▼
                Presigned URL
                        │
                        ▼
                ┌───────────────┐
                │   AWS S3      │
                │ Private Files │
                └───────────────┘

The Node.js server handles authentication, authorization, validation and metadata while the browser uploads the actual file directly to S3.

✨ Features
🔑 Authentication
User registration
User login
JWT-based authentication
Protected API routes
Password hashing using bcrypt
Token expiration
📁 File Management
Upload files
Download files
View uploaded files
File metadata stored in MongoDB
MIME-type validation
File-size validation
Unique S3 object keys
☁️ AWS S3 Integration
Private S3 bucket
Presigned upload URLs
Presigned download URLs
Direct browser-to-S3 uploads
Short-lived upload URLs
S3 object deletion
📂 Folder Management
Create folders
Create nested folders
Open folders
Store folder hierarchy in MongoDB
Move folders to trash
🗑️ Trash System
Soft delete files
Restore deleted files
Permanently delete files from S3
Automatic cleanup of old deleted files
📊 Storage Quota

Each user receives:

500 MB storage quota

Before generating an upload URL, the backend checks:

Current Storage Used + New File Size
                <=
          Storage Quota

If the quota would be exceeded, the upload request is rejected.

🛠️ Technology Stack
Backend
Node.js
Express.js
MongoDB
Mongoose
JWT
bcryptjs
Cloud Storage
AWS S3
AWS SDK for JavaScript
Frontend
HTML5
CSS3
JavaScript
Fetch API
Other
dotenv
CORS
node-cron
🏗️ Project Structure
media-vault/
│
├── backend/
│   │
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   └── s3.js
│   │   │
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── fileController.js
│   │   │   └── folderController.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js
│   │   │   └── quotaMiddleware.js
│   │   │
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── File.js
│   │   │   └── Folder.js
│   │   │
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── fileRoutes.js
│   │   │   └── folderRoutes.js
│   │   │
│   │   ├── jobs/
│   │   │   └── cleanupJob.js
│   │   │
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── .env.example
│   ├── .gitignore
│   └── package.json
│
├── frontend/
│   │
│   ├── css/
│   │   └── style.css
│   │
│   ├── js/
│   │   ├── auth.js
│   │   ├── register.js
│   │   └── dashboard.js
│   │
│   ├── index.html
│   ├── register.html
│   └── dashboard.html
│
└── README.md
🔄 Upload Workflow

The most important part of this project is the Presigned URL upload architecture.

Step 1 — User selects a file

The browser gets:

File Name
File Size
MIME Type
Folder ID
Step 2 — Browser requests an upload URL

The frontend sends:

POST /api/files/upload-url

with:

{
  "fileName": "resume.pdf",
  "contentType": "application/pdf",
  "fileSize": 250000,
  "folderId": null
}
Step 3 — JWT authentication

The backend verifies:

Authorization: Bearer <JWT>

The server identifies the logged-in user.

Step 4 — Backend validates the upload

The server checks:

User exists
JWT is valid
File size is valid
MIME type is allowed
Folder belongs to the user
Storage quota is sufficient
Step 5 — Generate S3 key

The backend creates a unique object key such as:

users/USER_ID/UUID-resume.pdf

This prevents filename collisions between users.

Step 6 — Generate Presigned URL

The backend creates a temporary AWS S3 upload URL.

Example:

Presigned URL
      ↓
Valid for 10 minutes

The URL is returned to the browser.

Step 7 — Direct upload to S3

The browser uploads the file directly:

Browser
   │
   │ PUT file
   ▼
AWS S3

The Node.js server does not receive the complete file.

This reduces unnecessary server bandwidth and memory usage.

Step 8 — Save metadata

After successful S3 upload, the frontend calls:

POST /api/files/complete

The backend stores metadata in MongoDB:

{
  "name": "resume.pdf",
  "s3Key": "users/userId/uuid-resume.pdf",
  "size": 250000,
  "mimeType": "application/pdf",
  "owner": "userId"
}
🔐 Security

The project uses several security mechanisms.

JWT Authentication

Protected endpoints require a valid JWT.

Client
  ↓
JWT
  ↓
Express Middleware
  ↓
Verify Token
  ↓
Allow / Reject Request
Password Hashing

Passwords are never stored directly.

Instead:

Plain Password
      ↓
bcrypt
      ↓
Hashed Password
      ↓
MongoDB
Private S3 Bucket

The S3 bucket should remain private.

Users cannot directly access objects using a public URL.

Instead:

Authenticated User
       ↓
Express API
       ↓
Authorization
       ↓
Presigned URL
       ↓
Temporary Access
       ↓
S3 Object
Short-Lived URLs

Presigned URLs expire after a short period.

Current implementation:

10 minutes

After expiration, the URL can no longer be used.

📊 Storage Quota

Each user has a default quota of:

500 MB

Example:

Quota       = 500 MB
Used        = 450 MB
New File    = 70 MB

450 + 70 = 520 MB

520 MB > 500 MB

The backend rejects the upload.

🗑️ Soft Delete & Cleanup

Files are not immediately removed from the database when the user clicks Trash.

Instead:

File
 ↓
isDeleted = true
 ↓
deletedAt = current date

The user can restore the file.

Files that remain in Trash for more than 30 days are processed by the background cleanup job.

MongoDB
   ↓
Deleted > 30 days
   ↓
Delete object from S3
   ↓
Delete metadata from MongoDB

The cleanup job uses:

node-cron
📡 API Endpoints
Authentication
Register
POST /api/auth/register

Request:

{
  "name": "John",
  "email": "john@example.com",
  "password": "password123"
}
Login
POST /api/auth/login

Request:

{
  "email": "john@example.com",
  "password": "password123"
}
Current User
GET /api/auth/me

Requires JWT.

📁 Folder APIs
Create Folder
POST /api/folders
List Folders
GET /api/folders
Delete Folder
DELETE /api/folders/:id
📄 File APIs
Generate Upload URL
POST /api/files/upload-url
Complete Upload
POST /api/files/complete
List Files
GET /api/files
Generate Download URL
GET /api/files/:id/download
Move File to Trash
DELETE /api/files/:id
View Trash
GET /api/files/trash
Restore File
PATCH /api/files/:id/restore
Permanently Delete
DELETE /api/files/:id/permanent
⚙️ Installation
1. Clone the repository
git clone YOUR_GITHUB_REPOSITORY_URL

Then:

cd media-vault
2. Install Backend Dependencies
cd backend
npm install
3. Configure Environment Variables

Create:

backend/.env

Use:

PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_long_random_secret

AWS_REGION=your_aws_region

AWS_ACCESS_KEY_ID=your_aws_access_key

AWS_SECRET_ACCESS_KEY=your_aws_secret_key

AWS_BUCKET_NAME=your_private_bucket_name

CLIENT_ORIGIN=http://localhost:5500
4. Start Backend

Development:

npm run dev

Or:

npm start

The backend will run on:

http://localhost:5000
5. Start Frontend

Open another terminal:

cd frontend

Run:

python -m http.server 5500

Then open:

http://localhost:5500
☁️ AWS S3 Setup

Create an S3 bucket and keep it private.

Do not make the bucket public just to make downloads work.

The application uses presigned URLs for temporary access.

Configure S3 CORS for local development:

[
  {
    "AllowedOrigins": [
      "http://localhost:5500"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ]
  }
]
🔒 Environment Security

Never upload your .env file to GitHub.

Your .gitignore contains:

.env
node_modules/

Upload:

.env.example

instead.

Never expose:

AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
MONGO_URI
JWT_SECRET

in your public repository.

⚠️ Current Upload Limitation

The current MVP supports files up to:

100 MB

For files larger than 100 MB, the next improvement would be:

AWS S3 Multipart Upload

Multipart upload can divide a large file into multiple parts and upload them independently.

🎯 Problem Solved

Traditional architecture:

Client
  ↓
Node.js
  ↓
S3

This makes the backend participate in transferring the entire file.

Media Vault:

Client
  ↓
Node.js
  ↓
Presigned URL
  ↓
Client ─────────→ S3

Node.js primarily handles:

Authentication
Authorization
Validation
Presigned URL generation
MongoDB metadata
Folder management
Storage quota
File lifecycle

S3 handles:

Actual file storage
File transfer

This makes the application more suitable for handling many file-upload requests without making the Express server a file-transfer bottleneck.

🧠 Key Concepts Demonstrated

This project demonstrates:

REST API development
JWT authentication
Authorization middleware
Password hashing
MongoDB schema design
MongoDB relationships
AWS S3 integration
Presigned URLs
Direct-to-cloud uploads
Storage quota management
File validation
Soft deletion
Background jobs
Cloud storage security
Separation of control plane and data plane
🚀 Future Improvements

Possible future enhancements:

S3 Multipart Upload for files >100 MB
File sharing between users
Role-based access control
Admin dashboard
Search functionality
File preview
Image thumbnails
Pagination
File versioning
Upload progress bar
Rate limiting
Virus scanning
S3 lifecycle policies
CloudFront integration
Production deployment
