#!/bin/bash

# Fix module-level OpenAI initialization
for file in app/api/chat/powerhouse/route.ts \
            app/api/chat/stream/route.ts \
            app/api/developer/generate/route.ts \
            app/api/javari/auto-heal/route.ts \
            app/api/javari/conversations/summary/route.ts \
            app/api/javari/learn-from-docs/route.ts \
            app/api/javari/stock-analysis/route.ts \
            app/api/sessions/\[id\]/generate-summary/route.ts \
            lib/autonomous-enhanced/embeddings.ts \
            lib/autonomous-enhanced/feedback-learning.ts \
            lib/autonomous-enhanced/proactive-suggestions.ts \
            lib/javari-knowledge.ts \
            lib/knowledge-integration.ts \
            lib/orchestrator/builder-orchestrator.ts \
            lib/orchestrator/continuous-learning.ts \
            lib/provider-manager.ts; do
  if [ -f "$file" ]; then
    echo "Processing $file"
    # Add export dynamic if it's an API route
    if [[ "$file" == app/api/* ]]; then
      if ! grep -q "export const dynamic" "$file"; then
        sed -i '1i export const dynamic = '\''force-dynamic'\'';' "$file"
      fi
    fi
  fi
done

echo "Done"
