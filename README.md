# Javari AI

**AI-powered assistant platform for CR AudioViz AI ecosystem**

## What It Actually Does

- Chat interface with AI (Claude, GPT-4, Gemini)
- File upload and processing
- Document search across platform documentation
- Multi-AI model selection
- Code generation assistance

## Current Status

✅ **Working:**
- User authentication (Supabase)
- Chat interface
- AI model selection
- Basic file upload UI

⚠️ **In Progress:**
- File processing backend
- Documentation ingestion
- Advanced features

❌ **Planned:**
- Voice input/output
- Visual avatar
- Autonomous app building

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Supabase (auth + database)
- Anthropic API (Claude)
- OpenAI API (GPT-4)
- Google AI API (Gemini)

## Setup

```bash
npm install
npm run dev
```

Required environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
```

## Features

### Chat Interface
- Select AI model (Claude Sonnet 4.5, GPT-4, Gemini)
- Conversation history
- Markdown rendering
- Code syntax highlighting

### File Upload
- Drag and drop interface
- Supports: PDF, DOCX, images, text files
- File size limit: 10MB

### Documentation Search
- Search across platform docs
- Semantic search (planned)
- Source attribution

## Roadmap

**Week 1:**
- Complete file processing
- Add documentation ingestion
- Test all features

**Week 2-4:**
- Voice features
- Enhanced UI
- Performance optimization

## Known Issues

- File processing incomplete
- Documentation ingestion not active
- Some TypeScript errors in development

## License

Proprietary - CR AudioViz AI, LLC

## Contact

For questions: support@craudiovizai.com
