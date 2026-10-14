"use client";

import { useEffect, useState } from "react";

export default function Header() {
  const [username, setUsername] = useState("Guest");
  const [time, setTime] = useState("");

  useEffect(() => {
    const user = localStorage.getItem("username");
    if (user) {
      setUsername(user);
    }

    const updateClock = () => {
      const now = new Date();

      setTime(
        now.toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "medium",
        })
      );
    };

    updateClock();

    const timer = setInterval(updateClock, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-cyan-500/20 bg-slate-900 px-8 py-5">

      <div>
        <h1 className="text-3xl font-bold text-cyan-400">
          Cyber Security Dashboard
        </h1>

        <p className="mt-1 text-sm text-gray-400">
          Monitor • Analyze • Secure
        </p>
      </div>

      <div className="text-right">

        <h2 className="text-lg font-semibold text-white">
          👤 {username}
        </h2>

        <p className="text-sm text-cyan-400">
          {time}
        </p>

      </div>

    </header>
  );
}