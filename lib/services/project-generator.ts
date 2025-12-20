// lib/services/project-generator.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - PROJECT GENERATOR
// Generates complete, deployable Next.js project files
// ═══════════════════════════════════════════════════════════════════════════════

interface ProjectFile {
  path: string;
  content: string;
}

interface GeneratedProject {
  files: ProjectFile[];
  name: string;
  description: string;
  framework: string;
}

interface ComponentCode {
  componentCode: string;
  componentName: string;
}

export class ProjectGenerator {
  
  /**
   * Generate package.json for a Next.js project
   */
  generatePackageJson(projectName: string, description: string): string {
    return JSON.stringify({
      name: projectName,
      version: "1.0.0",
      description: description,
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint"
      },
      dependencies: {
        "next": "14.2.15",
        "react": "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        "autoprefixer": "^10.4.20",
        "postcss": "^8.4.47",
        "tailwindcss": "^3.4.13",
        "typescript": "^5"
      }
    }, null, 2);
  }

  /**
   * Generate tsconfig.json
   */
  generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./*"] }
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"]
    }, null, 2);
  }

  /**
   * Generate tailwind.config.ts
   */
  generateTailwindConfig(): string {
    return `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
`;
  }

  /**
   * Generate postcss.config.mjs
   */
  generatePostCssConfig(): string {
    return `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
`;
  }

  /**
   * Generate next.config.ts
   */
  generateNextConfig(): string {
    return `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`;
  }

  /**
   * Generate globals.css with dark theme
   */
  generateGlobalsCss(): string {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0a0a0a;
  --foreground: #ededed;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
`;
  }

  /**
   * Generate layout.tsx
   */
  generateLayout(projectName: string): string {
    return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${projectName}",
  description: "Built by Javari AI - CR AudioViz AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gray-900">
        {children}
      </body>
    </html>
  );
}
`;
  }

  /**
   * Generate main page.tsx that renders the component
   */
  generatePage(componentName: string, componentImport: string): string {
    return `import ${componentName} from "@/components/${componentImport}";

export default function Home() {
  return (
    <main className="min-h-screen">
      <${componentName} />
    </main>
  );
}
`;
  }

  /**
   * Generate README.md
   */
  generateReadme(projectName: string, description: string): string {
    return `# ${projectName}

${description}

## Built by Javari AI

This application was automatically generated and deployed by [Javari AI](https://javariai.com), the autonomous development assistant from CR AudioViz AI.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view in browser.

## Tech Stack

- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **Deployed on:** Vercel

---

*"Your Story. Our Design."* - CR AudioViz AI
`;
  }

  /**
   * Generate .gitignore
   */
  generateGitignore(): string {
    return `# Dependencies
/node_modules
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts
`;
  }

  /**
   * Generate next-env.d.ts
   */
  generateNextEnvDts(): string {
    return `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.
`;
  }

  /**
   * Generate a complete Next.js project with the given component
   */
  generateProject(
    projectName: string,
    description: string,
    component: ComponentCode
  ): GeneratedProject {
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const componentFileName = component.componentName;
    
    const files: ProjectFile[] = [
      // Config files
      { path: 'package.json', content: this.generatePackageJson(sanitizedName, description) },
      { path: 'tsconfig.json', content: this.generateTsConfig() },
      { path: 'tailwind.config.ts', content: this.generateTailwindConfig() },
      { path: 'postcss.config.mjs', content: this.generatePostCssConfig() },
      { path: 'next.config.ts', content: this.generateNextConfig() },
      { path: '.gitignore', content: this.generateGitignore() },
      { path: 'next-env.d.ts', content: this.generateNextEnvDts() },
      { path: 'README.md', content: this.generateReadme(projectName, description) },
      
      // App files
      { path: 'app/globals.css', content: this.generateGlobalsCss() },
      { path: 'app/layout.tsx', content: this.generateLayout(projectName) },
      { path: 'app/page.tsx', content: this.generatePage(component.componentName, componentFileName) },
      
      // Component
      { path: `components/${componentFileName}.tsx`, content: component.componentCode },
    ];

    return {
      files,
      name: sanitizedName,
      description,
      framework: 'nextjs',
    };
  }

  /**
   * Extract component name from code
   */
  extractComponentName(code: string): string {
    // Try to find export default function/const ComponentName
    const defaultExportMatch = code.match(/export\s+default\s+(?:function|const)\s+(\w+)/);
    if (defaultExportMatch) return defaultExportMatch[1];

    // Try to find const ComponentName: React.FC
    const fcMatch = code.match(/const\s+(\w+)\s*:\s*React\.FC/);
    if (fcMatch) return fcMatch[1];

    // Try to find function ComponentName
    const functionMatch = code.match(/(?:export\s+)?function\s+([A-Z]\w+)/);
    if (functionMatch) return functionMatch[1];

    // Try to find const ComponentName = () =>
    const arrowMatch = code.match(/(?:export\s+)?const\s+([A-Z]\w+)\s*=\s*\(/);
    if (arrowMatch) return arrowMatch[1];

    // Default
    return 'MainComponent';
  }

  /**
   * Clean and prepare component code for deployment
   */
  prepareComponentCode(code: string): ComponentCode {
    let cleanCode = code;
    
    // Remove markdown code fences if present
    cleanCode = cleanCode.replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gm, '');
    cleanCode = cleanCode.replace(/```$/gm, '');
    
    // Extract component name
    const componentName = this.extractComponentName(cleanCode);
    
    // Ensure the code has proper exports
    if (!cleanCode.includes('export default')) {
      // Add export default if missing
      cleanCode = cleanCode.replace(
        new RegExp(`(const|function)\\s+${componentName}`),
        `export default $1 ${componentName}`
      );
    }
    
    // Ensure React import is present
    if (!cleanCode.includes("import React") && !cleanCode.includes("from 'react'")) {
      // Check if hooks are used
      const usesHooks = /use[A-Z]\w+/.test(cleanCode);
      if (usesHooks) {
        const hookMatches = cleanCode.match(/use[A-Z]\w+/g) || [];
        const uniqueHooks = [...new Set(hookMatches)].filter(h => 
          ['useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'useContext', 'useReducer'].includes(h)
        );
        if (uniqueHooks.length > 0) {
          cleanCode = `import { ${uniqueHooks.join(', ')} } from 'react';\n\n${cleanCode}`;
        }
      }
    }
    
    return {
      componentCode: cleanCode.trim(),
      componentName,
    };
  }
}

export const projectGenerator = new ProjectGenerator();
