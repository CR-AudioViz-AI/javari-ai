# Documentation Engine - Examples

## Single Task Documentation

### Input
```typescript
import { generateDocumentation } from "@/lib/docs/generate";

const result = await generateDocumentation({
  taskId: "task-123",
  taskTitle: "Build User Authentication System",
  taskDescription: "Implement JWT-based authentication with login and registration",
  deliverable: {
    code: "...",
    files: ["auth.ts", "middleware.ts"],
    endpoints: ["/api/login", "/api/register"]
  },
  buildCost: 0.42,
  validationScore: 92,
  executionTime: 5420,
  userId: "user-id"
});

console.log(result.markdown);
```

### Output (Markdown)
```markdown
# Build User Authentication System

## Task Summary

Successfully implemented a JWT-based authentication system with secure login and registration endpoints, achieving a validation score of 92/100.

## What Was Built

A complete authentication system consisting of:
- JWT token generation and verification
- Secure password hashing with bcrypt
- Login endpoint (/api/login) with email/password validation
- Registration endpoint (/api/register) with user creation
- Authentication middleware for protected routes
- Session management and token refresh logic

Key files created:
- auth.ts: Core authentication logic
- middleware.ts: Route protection

## Architecture & Design Decisions

This architecture was chosen for several key reasons:

1. **Security**: JWT tokens provide stateless authentication, reducing server load
2. **Scalability**: Stateless design allows horizontal scaling
3. **Industry Standard**: JWT is widely adopted and well-understood
4. **Flexibility**: Easy to extend with OAuth or social login

Trade-offs:
- Token revocation requires additional infrastructure
- Token size can be larger than session IDs

## Cost Breakdown

| Item | Cost |
|------|------|
| Build & Development | $0.4200 |
| Quality Validation | $0.4500 |
| **Total** | **$0.8700** |

**Tokens Used:** 1,500

## Next Recommended Steps

1. Implement password reset functionality via email
2. Add rate limiting to prevent brute force attacks
3. Set up refresh token rotation for enhanced security
4. Add two-factor authentication (2FA) option
5. Implement OAuth integration for social login

## Metadata

- **Task ID:** task-123
- **Generated:** 3/6/2026, 12:00:00 AM
- **Execution Time:** 5420ms
- **Validation Score:** 92/100
```

---

## Roadmap Documentation

### Input
```typescript
import { generateRoadmapDocumentation } from "@/lib/docs/generate";

const result = await generateRoadmapDocumentation(
  "SaaS MVP Development",
  [
    {
      taskId: "task-1",
      taskTitle: "Build Authentication",
      taskDescription: "JWT auth system",
      deliverable: { /* ... */ },
      buildCost: 0.42,
      validationScore: 92
    },
    {
      taskId: "task-2",
      taskTitle: "Stripe Integration",
      taskDescription: "Payment processing",
      deliverable: { /* ... */ },
      buildCost: 0.38,
      validationScore: 88
    },
    {
      taskId: "task-3",
      taskTitle: "Dashboard UI",
      taskDescription: "User dashboard",
      deliverable: { /* ... */ },
      buildCost: 0.51,
      validationScore: 95
    }
  ]
);

console.log(result.markdown);
```

### Output
Complete markdown document with:
- Overview
- Individual task documentation (all 3 tasks)
- Roadmap summary
- Total costs
- Timestamp

---

## API Usage

### Generate Single Task Docs

```bash
curl -X POST https://javari-ai.vercel.app/api/javari/docs \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "taskTitle": "Build Authentication",
    "taskDescription": "JWT auth system",
    "deliverable": {...},
    "buildCost": 0.42,
    "validationScore": 92
  }'
```

### Generate Roadmap Docs

```bash
curl -X POST https://javari-ai.vercel.app/api/javari/docs \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "roadmap",
    "roadmapTitle": "SaaS MVP",
    "tasks": [...]
  }'
```

---

## Benefits

✅ **Customer Transparency** - Clear explanation of work done  
✅ **Cost Visibility** - Detailed breakdown of expenses  
✅ **Architecture Clarity** - Understand design decisions  
✅ **Next Steps** - Guidance on what to do next  
✅ **Professional Format** - Clean markdown ready to share  
