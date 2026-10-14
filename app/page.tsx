"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { users } from "@/lib/users";

export default function Home() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    const user = users.find(
      (u) =>
        u.username === username &&
        u.password === password
    );

    if (user) {
      localStorage.setItem("username", user.name);
      router.push("/dashboard");
    } else {
      alert("Invalid Username or Password");
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#050816] via-[#0f172a] to-[#020617]" />

      {/* Neon Glow */}
      <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-cyan-500/30 blur-[120px] animate-pulse"></div>

      <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-fuchsia-600/30 blur-[140px] animate-pulse"></div>

      <div className="absolute bottom-0 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[120px]"></div>

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
          linear-gradient(rgba(0,255,255,.15) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,255,.15) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Login Card */}
      <div className="relative w-[420px] rounded-3xl border border-cyan-400/20 bg-white/10 p-8 backdrop-blur-xl shadow-[0_0_40px_rgba(0,255,255,0.2)]">

        <h1 className="text-center text-4xl font-extrabold text-cyan-300">
          CYBER LOGIN
        </h1>

        <p className="mt-2 text-center text-gray-300">
          Welcome to Cyber Security Portal
        </p>

        <div className="mt-8">

          <label className="text-cyan-300">
            Username
          </label>

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter Username"
            className="mt-2 w-full rounded-xl border border-cyan-500/30 bg-black/40 p-3 text-white outline-none transition-all focus:border-cyan-400 focus:shadow-[0_0_20px_#00ffff]"
          />

        </div>

        <div className="mt-5">

          <label className="text-cyan-300">
            Password
          </label>

          <div className="mt-2 flex rounded-xl border border-cyan-500/30 bg-black/40">

            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password"
              className="w-full bg-transparent p-3 text-white outline-none"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="px-4 text-xl text-cyan-300"
            >
              {showPassword ? "🙈" : "👁"}
            </button>

          </div>

        </div>

        <div className="mt-6 flex justify-between text-sm text-gray-300">

          <label className="flex items-center gap-2">
            <input type="checkbox" />
            Remember me
          </label>

          <a
            href="#"
            className="text-cyan-400 hover:text-white"
          >
            Forgot?
          </a>

        </div>
                <button
          type="button"
          onClick={handleLogin}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 p-3 text-lg font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_#00ffff]"
        >
          LOGIN
        </button>

        <div className="mt-8 text-center text-gray-400">
          Don't have an account?
          <span className="cursor-pointer text-cyan-400 hover:text-white">
            {" "}
            Sign Up
          </span>
        </div>

      </div>

      {/* Bottom Glow */}
      <div className="absolute bottom-10 text-xs tracking-[6px] text-cyan-500/50 animate-pulse">
        CYBERPUNK • NEXT.JS • SECURITY
      </div>

    </main>
  );
}