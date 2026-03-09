// app/signup/page.tsx
// Javari AI — Sign Up Page
// Purpose: New user registration via Supabase Auth. Redirects to /javari on success.
// Date: 2026-03-09

import { Metadata } from "next";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create Account — Javari AI",
  description: "Create your free Javari AI account and start building today.",
};

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <SignupForm />
    </main>
  );
}
