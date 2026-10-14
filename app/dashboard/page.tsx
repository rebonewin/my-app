"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import StatCard from "@/components/StatCard";

export default function Dashboard() {
  return (
    <div className="flex min-h-screen bg-[#020617]">

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col">

        {/* Header */}
        <Header />

        {/* Dashboard Content */}
        <main className="flex-1 p-8">

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

            <StatCard
              title="Total Scans"
              value="25"
              color="text-cyan-400"
              icon="📊"
            />

            <StatCard
              title="High Risk"
              value="5"
              color="text-red-500"
              icon="🔴"
            />

            <StatCard
              title="Medium Risk"
              value="10"
              color="text-yellow-400"
              icon="🟡"
            />

            <StatCard
              title="Low Risk"
              value="10"
              color="text-green-400"
              icon="🟢"
            />

          </div>

          {/* Recent Activity */}
          <div className="mt-8 rounded-2xl border border-cyan-500/20 bg-slate-900 p-6">

            <h2 className="mb-4 text-2xl font-bold text-cyan-400">
              Recent Activity
            </h2>

            <div className="space-y-3 text-gray-300">

              <p>✔ Scan completed successfully.</p>

              <p>✔ Dashboard initialized.</p>

              <p>✔ No critical vulnerabilities detected.</p>

              <p>✔ System monitoring active.</p>

            </div>

          </div>

        </main>

      </div>

    </div>
  );
}