"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, Lock, Mail, User, ArrowRight, AlertCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("memorydesk_token");
    if (token) {
      fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) router.push("/");
        })
        .catch(() => {});
    }
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Registration failed.");
      }

      localStorage.setItem("memorydesk_token", data.access_token);
      localStorage.setItem("memorydesk_user", JSON.stringify(data.user));
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fef9ed] text-[#5d524b] flex items-center justify-center p-6 relative overflow-hidden font-serif">
      {/* Subtle peach atmospheric background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#fbd3be]/20 via-[#fef9ed] to-[#fef9ed] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#f5f0e4] border border-[#cec7bc] mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2e4d4d]" />
            <span className="text-[10px] font-mono tracking-widest text-[#2e4d4d] uppercase font-medium">
              MemoryDesk Auth
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#2e4d4d] tracking-tight">
            Create Engineer Account
          </h1>
          <p className="text-xs text-[#72675b] mt-2 font-serif italic">
            Join MemoryDesk to build your team&apos;s isolated memory network.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[25px] border border-[#cec7bc] bg-[#f5f0e4] p-8 shadow-none">
          {error && (
            <div className="mb-6 p-3.5 rounded-[16px] bg-[#8c5462]/10 border border-[#8c5462]/30 text-[#8c5462] text-xs flex items-center gap-2.5 font-mono">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-mono font-medium text-[#72675b] mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#72675b]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Engineer Name"
                  className="w-full pl-11 pr-4 py-3 rounded-[50px] bg-[#fef9ed] border border-[#cec7bc] text-sm text-[#5d524b] placeholder:text-[#cec7bc] focus:border-[#2e4d4d] focus:outline-none transition font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-mono font-medium text-[#72675b] mb-1.5">
                Username
              </label>
              <div className="relative">
                <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#72675b]" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Choose username"
                  className="w-full pl-11 pr-4 py-3 rounded-[50px] bg-[#fef9ed] border border-[#cec7bc] text-sm text-[#5d524b] placeholder:text-[#cec7bc] focus:border-[#2e4d4d] focus:outline-none transition font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-mono font-medium text-[#72675b] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#72675b]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-11 pr-4 py-3 rounded-[50px] bg-[#fef9ed] border border-[#cec7bc] text-sm text-[#5d524b] placeholder:text-[#cec7bc] focus:border-[#2e4d4d] focus:outline-none transition font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-mono font-medium text-[#72675b] mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#72675b]" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full pl-11 pr-4 py-3 rounded-[50px] bg-[#fef9ed] border border-[#cec7bc] text-sm text-[#5d524b] placeholder:text-[#cec7bc] focus:border-[#2e4d4d] focus:outline-none transition font-sans"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3.5 rounded-full bg-[#2e4d4d] hover:bg-[#253f3f] text-[#fef9ed] font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition active:scale-[0.99] border border-[#2e4d4d]"
            >
              <span>{loading ? "Creating Account..." : "Create Account"}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#cec7bc]/50 text-center text-xs text-[#72675b] font-serif">
            Already have an account?{" "}
            <Link href="/login" className="text-[#2e4d4d] hover:text-[#5d524b] font-medium underline transition">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
