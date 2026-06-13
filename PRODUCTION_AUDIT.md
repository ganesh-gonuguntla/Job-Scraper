# Production-Level Audit Report
## AI Job Application Agent SaaS

**Report Date**: June 13, 2026  
**Overall Status**: ⚠️ **NOT PRODUCTION READY** (Multiple critical bugs & missing features)

---

## CRITICAL ISSUES (MUST FIX BEFORE DEPLOY)

### 🔴 **1. Vector Search Index Dimension Mismatch**
**Severity**: CRITICAL | **Impact**: Matching agent completely broken

**Problem**: 
- Config file (`ai-service/app/config.py`) specifies `"all-MiniLM-L6-v2"` embedding model → **384 dimensions**
- `DEPLOYMENT.md` specifies **768 dimensions** for MongoDB Atlas Vector Search indexes
- Resume Intelligence Agent generates 768-dim embeddings via `genai.embed_content(model="models/text-embedding-004")`
- Result: Dimension mismatch causes vector queries to fail silently or crash

**Code Evidence**:
```python
# ai-service/app/config.py - says 384-dim model
embedding_model: str = "all-MiniLM-L6-v2"  # ❌ 384 dimensions

# ai-service/app/agents/resume_intelligence.py - generates 768-dim
genai.embed_content(model="models/text-embedding-004", ...)  # ✅ 768 dimensions
```

**Fix Required**:
- [ ] Choose ONE embedding model and stick with it:
  - Option A: Use local `all-MiniLM-L6-v2` (384-dim) everywhere
  - Option B: Use Gemini `text-embedding-004` (768-dim) everywhere
- [ ] Update MongoDB Atlas indexes to match chosen dimension
- [ ] Update all agents to use consistent embedding generation

**Recommendation**: Use Gemini embeddings (768-dim) for consistency with current implementation.

---

### 🔴 **2. Gmail SMTP Authentication Completely Broken**
**Severity**: CRITICAL | **Impact**: Email sending fails 100% of the time

**Problem**:
- `apply_sender.py` expects `SMTP_PASS` environment variable (Gmail App Password)
- **No validation** that SMTP credentials are configured before attempting to send
- Falls back to **silent mock send** without logging to user dashboard
- User thinks emails are sent, but nothing actually goes out

**Code Evidence**:
```python
# ai-service/app/agents/apply_sender.py
if not smtp_pass or not from_email:
    print("[WARNING] Gmail App Password is not configured...")
    print(f"[MOCK EMAIL SEND] To: {to_email} | Subject: {subject}")
    return False  # ❌ Returns False silently, no error to user
```

**Result**: 
- User enables auto-apply
- System claims emails are sent
- User never receives feedback that emails actually failed

**Fix Required**:
- [ ] Add **mandatory validation** in settings endpoint to require email configuration before enabling auto-apply
- [ ] Show explicit error in dashboard: "Gmail not configured. Go to settings to connect email."
- [ ] Implement proper Gmail OAuth 2.0 flow (not SMTP app password—that's deprecated/unreliable)
- [ ] Add retry logic with exponential backoff
- [ ] Log all email failures to `agent_logs` with user-visible error messages

---

### 🔴 **3. No Error Handling for Gemini API Failures**
**Severity**: CRITICAL | **Impact**: Silent failures cascade through pipeline

**Problem**:
- All agents call Gemini API with minimal error handling
- Falls back to hardcoded boilerplate responses without retries
- No rate limiting or circuit breaker
- Gemini quota exhaustion silently degrades email/resume quality
- No alerts to tell you the API is failing

**Code Evidence**:
```python
# ai-service/app/agents/email_writer.py
try:
    response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
    email_data = json.loads(response.text)
except Exception as e:
    print(f"Gemini email writing failed: {str(e)}")  # ❌ Just prints, no retry
    email_data = {
        "subject": f"Application for {job_title} - {candidate_name}",
        "body": f"Dear {recruiter_name},\n\nI am writing to express my strong interest..."  # ❌ Generic fallback
    }
```

**Consequences**:
- Matching scores become inaccurate if embeddings fail
- Resumes generate as plain boilerplate instead of tailored
- Emails are generic/low-quality

**Fix Required**:
- [ ] Implement exponential backoff + 3 retry attempts for all Gemini calls
- [ ] Add request rate limiting (queue jobs if hitting quota)
- [ ] Monitor Gemini quota usage and alert when low
- [ ] Proper error responses (not silent fallbacks)
- [ ] Log all failures to `agent_logs` collection

---

### 🔴 **4. Database Vector Search Queries Not Implemented**
**Severity**: CRITICAL | **Impact**: Matching Agent scoring is fake

**Problem**:
- Matching Agent computes similarity using **cosine similarity in Python** (slow, local)
- MongoDB Vector Search indexes defined in `DEPLOYMENT.md` are **never actually used**
- No aggregation pipeline to query `resumes.embedding` vs `jobs.embedding`
- Agent uses manual similarity calculation instead of database optimization

**Code Evidence**:
```python
# ai-service/app/agents/matching.py - manually computes cosine similarity
def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot_product = sum(x * y for x, y in zip(v1, v2))
    # ❌ All this happens in Python, not in database
```

**Problem**:
- Unscalable: pulling embeddings into Python for every job match
- No vector indexing benefit from MongoDB Atlas
- Missing opportunity for semantic similarity queries

**Fix Required**:
- [ ] Implement MongoDB aggregation pipeline with `$search` operator
- [ ] Use native Vector Search for similarity queries
- [ ] Cache embedding results to avoid redundant API calls

---

### 🔴 **5. Email Configuration Stored as PLAINTEXT**
**Severity**: CRITICAL | **Impact**: SMTP credentials exposed in database

**Problem**:
- User's Gmail App Password stored as plaintext in `Profile.preferences.smtp_pass`
- Anyone with database access can steal all user email credentials
- No encryption, no hashing, no secret management

**Code Evidence**:
```javascript
// server/src/routes/settings.js
if (smtp_pass !== undefined) update['preferences.smtp_pass'] = smtp_pass;
// ❌ Stored as plaintext: { preferences: { smtp_pass: "abcd1234wxyz" } }
```

**Fix Required**:
- [ ] **NEVER store SMTP passwords**
- [ ] Use OAuth 2.0 for Gmail (token stored encrypted)
- [ ] Encrypt sensitive fields with AES-256-GCM if local storage required
- [ ] Implement secret rotation

---

### 🔴 **6. No Resume File Cleanup or Virus Scanning**
**Severity**: CRITICAL | **Impact**: Disk space exhaustion + malware risks

**Problem**:
- Resume files uploaded to `server/uploads/` with no cleanup
- No file size validation (only 5MB limit, easily bypassed)
- No virus scanning
- No TTL policy
- Disk will fill up indefinitely

**Code Evidence**:
```javascript
// server/src/routes/profile.js
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },  // Only 5MB, not persistent cleanup
  // ❌ No virus scanning, no TTL
});
```

**Fix Required**:
- [ ] Implement file cleanup (delete after 30 days or after processing)
- [ ] Add ClamAV or VirusTotal integration for scanning
- [ ] Implement S3 presigned URL for file serving (not direct disk access)
- [ ] Add audit logging for file access

---

### 🔴 **7. Zero Input Validation Anywhere**
**Severity**: CRITICAL | **Impact**: SQL injection, XSS, data corruption

**Problem**:
- Express routes accept **any input** without validation
- No schema validation (missing Zod/Joi)
- Frontend API client has no error handling
- Easy to corrupt database with malformed requests

**Code Evidence**:
```javascript
// server/src/routes/auth.js
router.post('/register', async (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {  // ❌ Only checks null/undefined
    // ❌ No format validation: password length, email format, SQL injection check
```

**Fix Required**:
- [ ] Add Zod or Joi schema validation to every route
- [ ] Validate email format, password strength, job IDs
- [ ] Implement rate limiting on auth endpoints (prevent brute force)
- [ ] Add CSRF token protection

---

### 🔴 **8. No Refresh Token Mechanism**
**Severity**: HIGH | **Impact**: Tokens expire after 7 days, user forcibly logged out

**Problem**:
- JWT tokens expire after 7 days (`JWT_EXPIRES_IN=7d`)
- **No refresh endpoint** to get new token without re-logging in
- User must log back in or re-upload resume
- Bad UX, loses user context

**Code Evidence**:
```javascript
// server/src/routes/auth.js
const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',  // ❌ Fixed expiration, no refresh
});
```

**Fix Required**:
- [ ] Implement refresh token flow (short-lived access + long-lived refresh)
- [ ] Store refresh tokens in httpOnly cookies (secure)
- [ ] Add `/auth/refresh` endpoint

---

### 🔴 **9. DuckDuckGo Scraping Will Get Blocked**
**Severity**: HIGH | **Impact**: Job search agent fails after few requests

**Problem**:
- Job Search Agent scrapes DuckDuckGo directly using HTTP requests
- DuckDuckGo rate-limits and blocks after ~10-20 requests
- No backoff, no rotating proxies, no user-agent rotation
- Agent will fail silently

**Code Evidence**:
```python
# ai-service/app/agents/job_search.py
url = "https://html.duckduckgo.com/html/"
async with httpx.AsyncClient() as client:
    response = await client.post(url, data={"q": query}, headers=headers, timeout=12.0)
    # ❌ No rate limiting, no proxy rotation, gets blocked
```

**Fix Required**:
- [ ] Implement rate limiting with exponential backoff
- [ ] Use job board APIs instead (LinkedIn, Indeed API, etc.)
- [ ] Add proxy rotation
- [ ] Implement circuit breaker for repeated failures

---

## HIGH-PRIORITY BUGS (Fix before MVP)

### 🟠 **10. Resume Parser File Path Resolution Broken**
**Severity**: HIGH | **Impact**: Resume parsing fails on production

**Problem**:
```python
# ai-service/app/agents/resume_intelligence.py
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
file_path = os.path.join(base_dir, "server", resume_url.lstrip("/"))
# ❌ Assumes "server" folder exists relative to ai-service
# ❌ When deployed to separate containers, path won't exist
```

**Result**: Resume parsing fails 100% on production where services are containerized.

**Fix Required**:
- [ ] Store resume files in MongoDB as binary data or S3
- [ ] Don't rely on shared filesystem between services

---

### 🟠 **11. No Logging Aggregation**
**Severity**: HIGH | **Impact**: Can't debug production issues

**Problem**:
- Errors logged to stdout only
- No centralized logging (Winston, Sentry, DataDog)
- Can't see what's happening in production
- No error alerts

**Fix Required**:
- [ ] Implement structured logging (Winston + transports)
- [ ] Send logs to Sentry/DataDog for monitoring
- [ ] Add performance metrics

---

### 🟠 **12. No Rate Limiting Middleware**
**Severity**: HIGH | **Impact**: Abuse/DOS vulnerability

**Problem**:
- Config defines `MAX_APPLICATIONS_PER_DAY=20` but **never enforced**
- Middleware missing entirely
- Anyone can spam requests

**Fix Required**:
- [ ] Add express-rate-limit middleware
- [ ] Enforce per-user rate limits on key endpoints
- [ ] Add Redis for distributed rate limiting

---

### 🟠 **13. Job Contact Email Extraction Too Simplistic**
**Severity**: HIGH | **Impact**: Emails sent to wrong person/bounce addresses

**Problem**:
```python
# ai-service/app/agents/recruiter_discovery.py
if not email:
    clean_company = re.sub(r'[^a-zA-Z0-9]', '', company).lower()
    email = f"careers@{domain}"  # ❌ Just guesses "careers@domain.com"
```

**Result**: If real email not found, falls back to generic guesses that bounce.

**Fix Required**:
- [ ] Use LinkedIn recruiter search API
- [ ] Use Hunter.io or similar email finder API
- [ ] Implement better parsing of careers pages

---

### 🟠 **14. Matching Score Calculation Missing Location Weight**
**Severity**: MEDIUM | **Impact**: Wrong matches, low relevance

**Problem**:
```python
# ai-service/app/agents/matching.py
if "remote" in job_loc or "remote" in profile_loc:
    location_score = 10.0
elif job_loc in profile_loc or profile_loc in job_loc:
    location_score = 10.0
else:
    location_score = 5.0  # ❌ Only gets 5/10 if location doesn't match AT ALL
```

**Result**: If user is in NYC but job is in SF, they get a mismatch penalty but still get shown the job (wrong).

**Fix Required**:
- [ ] Integrate geolocation API for distance calculation
- [ ] Use realistic location matching (e.g., reject if >X miles unless remote)

---

### 🟠 **15. Missing Graceful Shutdown**
**Severity**: MEDIUM | **Impact**: Data loss on restart

**Problem**:
- No graceful shutdown handlers
- Long-running requests killed mid-operation
- Database transactions not completed

**Fix Required**:
- [ ] Add SIGTERM/SIGINT handlers
- [ ] Close DB connections cleanly
- [ ] Drain in-flight requests before stopping

---

## MEDIUM-PRIORITY ISSUES

### 🟡 **16. No Pagination on Jobs Endpoint**
```javascript
// server/src/routes/jobs.js
router.get('/', authenticate, async (req, res, next) => {
  const jobs = await Job.find().sort({ scraped_at: -1 }).skip(skip).limit(limit);
  // ❌ No user filter - returns ALL jobs in system, not user's matches
```

**Fix Required**:
- [ ] Filter jobs to user's matches only
- [ ] Add proper sorting/filtering

---

### 🟡 **17. Settings Endpoint Doesn't Actually Save Most Settings**
```javascript
// server/src/routes/settings.js
const update = {};
if (auto_apply !== undefined) update['preferences.auto_apply'] = auto_apply;
// ❌ Updates go to profile, but agent never reads them
```

**Fix Required**:
- [ ] Ensure agent actually checks these preferences during execution

---

### 🟡 **18. No Async Job Queue**
**Severity**: MEDIUM | **Impact**: Long operations timeout

**Problem**:
- All processing happens synchronously in request handlers
- Resume analysis can take 5+ seconds
- Express request times out

**Fix Required**:
- [ ] Implement job queue (Bull, RQ)
- [ ] Return async job ID immediately
- [ ] Poll status endpoint

---

### 🟡 **19. Frontend Auth Callback Not Implemented**
```javascript
// server/src/routes/auth.js
// ❌ OAuth callback missing
// ❌ Token exchange should be server-side, not client-side
```

---

### 🟡 **20. No CORS Validation**
```javascript
// server/src/index.js
cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true })
// ✅ Good, but needs stricter in production
```

---

## SECURITY VULNERABILITIES

### 🔓 **21. JWT Secret Potentially Weak**
- Default `.env.example` shows placeholder secret
- No validation that secret is strong in production

### 🔓 **22. MongoDB Connection String Exposed in Error Messages**
- Connection errors might leak credentials

### 🔓 **23. No API Rate Limiting**
- Anyone can hammer endpoints

### 🔓 **24. Sensitive Logs Might Contain PII**
- Resume text logged to stdout (contains personal info)

---

## MISSING FEATURES FOR MVP

### ❌ **25. No Email Template System**
- Emails are generated per-job but no templates
- No A/B testing capability

### ❌ **26. No Duplicate Application Prevention**
- User could apply to same job twice

### ❌ **27. No Application Deduplication**
```python
# supervisor.py runs independently each time
# ❌ Doesn't check if job already processed
```

### ❌ **28. No Resume Version Control**
- Each resume generates new version
- No way to roll back to previous

### ❌ **29. No Application Status Tracking**
- User can't see: "Applied", "Interview", "Rejected", "Offer"
- Just sees "applied"

### ❌ **30. No Email Verification**
- Anyone can sign up with fake email

---

## DEPLOYMENT-BLOCKING ISSUES

### 🚫 **31. No CI/CD Pipeline**
- No automated tests
- No deployment automation
- Manual deployment required

### 🚫 **32. No Health Check Endpoints**
```javascript
// server/src/index.js
app.get('/health', (req, res) => {
  res.json({ success: true, service: 'job-agent-server', status: 'healthy', ... });
});
// ✅ Exists, but doesn't check database connectivity
```

**Fix Required**:
```javascript
app.get('/health', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ success: true, status: 'healthy' });
  } catch (e) {
    res.status(503).json({ success: false, status: 'unhealthy', error: e.message });
  }
});
```

### 🚫 **33. No Environment Variable Validation**
- App starts even with missing critical env vars
- Error happens at runtime, not startup

### 🚫 **34. No Database Indexing Script**
- Vector Search indexes must be created manually
- No way to auto-create on deploy

### 🚫 **35. MongoDB URI Validation Missing**
```python
# ai-service/app/config.py
mongodb_uri: str = "mongodb://localhost:27017/job-agent"
# ❌ No validation that URI is valid
```

---

## FRONTEND ISSUES

### 🟠 **36. Dashboard Doesn't Actually Trigger Agent Pipeline**
```javascript
// DashboardPage.jsx
// ❌ Tab structure exists but no "Run Agent" button
// ❌ No way to manually trigger /agent/run
```

### 🟠 **37. No Real-Time Updates**
- Dashboard doesn't refresh automatically
- No WebSocket for agent status
- User sees stale data

### 🟠 **38. No Error Handling in API Calls**
```javascript
// frontend/src/api/client.js
api.interceptors.response.use(
  response => response,
  // ❌ No error handler - errors silently fail
);
```

### 🟠 **39. Email Preview Not Implemented**
- User can't see generated email before send

### 🟠 **40. No File Upload Progress**
- Large resume uploads have no progress indicator

---

## SUMMARY TABLE

| ID | Issue | Severity | Category | Impact |
|----|-------|----------|----------|--------|
| 1 | Vector dimension mismatch | 🔴 CRITICAL | Data | Matching broken |
| 2 | Gmail SMTP broken | 🔴 CRITICAL | Email | No emails sent |
| 3 | No Gemini error handling | 🔴 CRITICAL | AI | Silent failures |
| 4 | Vector queries not used | 🔴 CRITICAL | Data | Unscalable |
| 5 | Passwords plaintext | 🔴 CRITICAL | Security | Data breach risk |
| 6 | No file cleanup | 🔴 CRITICAL | Storage | Disk exhaustion |
| 7 | Zero input validation | 🔴 CRITICAL | Security | Injection attacks |
| 8 | No refresh tokens | 🔴 CRITICAL | Auth | Session expiry UX |
| 9 | DuckDuckGo blocked | 🔴 CRITICAL | Scraping | Job search fails |
| 10 | File path resolution | 🟠 HIGH | Deployment | Prod broken |
| 11 | No logging | 🟠 HIGH | Ops | Can't debug |
| 12 | No rate limiting | 🟠 HIGH | Security | DOS vulnerability |
| 13 | Email extraction basic | 🟠 HIGH | Matching | Wrong contacts |
| 14 | Location scoring off | 🟠 MEDIUM | Matching | Wrong matches |
| 15 | No graceful shutdown | 🟠 MEDIUM | Ops | Data loss |

---

## PRODUCTION READINESS SCORE

| Component | Score | Status |
|-----------|-------|--------|
| **AI Agents** | 65% | Broken (embedding mismatch, no error handling) |
| **Backend API** | 55% | Vulnerable (no validation, plaintext secrets) |
| **Frontend** | 40% | Incomplete (no real-time, no error handling) |
| **Database** | 45% | Incomplete (vector indexes not working) |
| **Deployment** | 20% | Not ready (no CI/CD, no validation) |
| **Security** | 30% | Critical vulnerabilities |
| **Operations** | 25% | No monitoring, no logging |
| **Overall** | **39%** | **❌ NOT PRODUCTION READY** |

---

## DEPLOYMENT READINESS CHECKLIST

- [ ] Fix embedding dimension mismatch (critical blocker #1)
- [ ] Implement proper Gmail OAuth (critical blocker #2)
- [ ] Add Gemini error handling + retries
- [ ] Implement MongoDB Vector Search properly
- [ ] Encrypt/remove plaintext credentials
- [ ] Add file cleanup + virus scanning
- [ ] Add input validation to all routes
- [ ] Implement refresh token flow
- [ ] Replace DuckDuckGo with proper job APIs
- [ ] Fix resume file path resolution
- [ ] Add structured logging (Winston + Sentry)
- [ ] Add rate limiting middleware
- [ ] Implement job queue for async processing
- [ ] Add CI/CD pipeline (GitHub Actions)
- [ ] Add comprehensive error handling frontend
- [ ] Implement real-time updates (WebSocket/polling)
- [ ] Add end-to-end tests
- [ ] Security audit (OWASP top 10)
- [ ] Load testing
- [ ] Database backup/recovery plan
- [ ] Monitoring + alerting setup

---

## ESTIMATED TIME TO PRODUCTION

- **Critical Fixes**: 40-50 hours (blockers 1-9)
- **High-Priority**: 30-40 hours (blockers 10-20)
- **MVP Features**: 20-30 hours
- **Testing + QA**: 20-30 hours
- **Deployment + Ops**: 15-20 hours

**Total**: ~140-180 hours (~4-5 weeks for one developer)

---

## RECOMMENDED QUICK WINS (Start Here)

1. ✅ **Day 1**: Fix embedding dimension mismatch → Test matching works
2. ✅ **Day 1-2**: Implement Gmail OAuth → Test email sending works
3. ✅ **Day 2-3**: Add input validation + rate limiting
4. ✅ **Day 3-4**: Add Gemini error handling + retries
5. ✅ **Day 5**: Fix file path issue (use S3)
6. ✅ **Day 6-7**: Add structured logging + monitoring

After these 7 days, system will be 70% more stable and testable.

