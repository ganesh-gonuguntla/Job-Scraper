# Deployment Guide

<!-- Deployment instructions for Render, Railway, and Vercel platforms --> — Phase 10

This guide details the step-by-step process of deploying the monorepo services to production environments.

---

## 1. Database Setup: MongoDB Atlas

The production system requires a MongoDB Atlas cluster to support the MongoDB Atlas Vector Search indexing used by the Matching Agent.

### Step 1: Create a Cluster
1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new shared or dedicated cluster (M0 or higher).
3. Whitelist access from all IPs (`0.0.0.0/0`) or configure specific outbound IPs from your web service providers (Render/Railway).

### Step 2: Create Vector Search Indexes
Create search indexes for semantic similarity queries. In the Atlas UI under **Search Indexes**, create two JSON index configurations:

1. **resumes Index**:
   * **Collection**: `resumes`
   * **Index Name**: `default`
   * **Configuration JSON**:
     ```json
     {
       "mappings": {
         "dynamic": true,
         "fields": {
           "embedding": {
             "type": "knnVector",
             "dimensions": 768,
             "similarity": "dotProduct"
           }
         }
       }
     }
     ```

2. **jobs Index**:
   * **Collection**: `jobs`
   * **Index Name**: `default`
   * **Configuration JSON**:
     ```json
     {
       "mappings": {
         "dynamic": true,
         "fields": {
           "embedding": {
             "type": "knnVector",
             "dimensions": 768,
             "similarity": "dotProduct"
           }
         }
       }
     }
     ```

---

## 2. AI Service Deployment (FastAPI): Render or Railway

The AI service executes the LangGraph supervisor workflow, parses resumes, and calls the Gemini APIs.

### Setup Steps
1. Create a new **Web Service** on Render or Railway, pointing to your code repository.
2. Set the root directory to `ai-service`.
3. Set the Build Command:
   ```bash
   pip install -r requirements.txt
   ```
4. Set the Start Command:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. Add the following **Environment Variables**:
   * `MONGODB_URI`: Your production MongoDB Atlas connection string.
   * `GEMINI_API_KEY`: Your Google Gemini API Developer Key.
   * `PORT`: `8000` (or leave default).
   * `MATCH_THRESHOLD`: `40`
   * `EMBEDDING_MODEL`: `models/text-embedding-004`

---

## 3. Express API Server Deployment: Render

The Express server handles authentication, session tokens, file uploads, settings updates, and schedules background tasks.

### Setup Steps
1. Create a new **Web Service** on Render.
2. Set the root directory to `server`.
3. Set the Build Command:
   ```bash
   npm install
   ```
4. Set the Start Command:
   ```bash
   npm run start
   ```
5. Add the following **Environment Variables**:
   * `MONGODB_URI`: Your production MongoDB Atlas connection string.
   * `JWT_SECRET`: A secure random secret string for JSON Web Token signing.
   * `JWT_EXPIRES_IN`: `7d`
   * `PORT`: `5000`
   * `AI_SERVICE_URL`: The URL of your deployed FastAPI AI service (e.g., `https://applyai-ai-service.onrender.com`).
   * `FRONTEND_URL`: The URL of your deployed React application (e.g., `https://applyai-frontend.vercel.app`).
   * `NODE_ENV`: `production`

---

## 4. Frontend Client Deployment: Vercel

The React frontend compiles down to static assets, calling the Express API server endpoints.

### Setup Steps
1. Create a new project on Vercel and import your repository.
2. Set the root directory to `frontend`.
3. Vercel will automatically detect the **Vite** framework.
4. Add the following **Environment Variable**:
   * `VITE_API_URL`: The URL of your deployed Express server (e.g., `https://applyai-server.onrender.com`).
5. Click **Deploy**. Vercel will build and serve your static client.
