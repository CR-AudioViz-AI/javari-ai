// app/login/page.tsx
// Javari AI — Login Page
// Purpose: Email/password sign-in via Supabase Auth. Redirects to /javari on success.
// Date: 2026-03-09

import { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In — Javari AI",
  description: "Sign in to Javari AI — your autonomous AI operating system.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <LoginForm />
    </main>
  );
}
