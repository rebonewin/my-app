"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import DashboardSummary from "@/components/DashboardSummary";
import ScanResult from "@/components/ScanResult";

export default function Scanner() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);


  const startScan = async () => {

    if (!url.trim()) {
      alert("Please enter a target URL");
      return;
    }


    setLoading(true);
    setShowResult(false);
    setStatus("Scanning Target...");
    setProgress(0);


    let value = 0;


    const interval = setInterval(async () => {

      value += 5;

      setProgress(value);


      if (value >= 100) {

        clearInterval(interval);


        try {

          const res = await fetch("/api/scan", {

            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              url,
            }),

          });



          const scan = await res.json();


          setResult(scan);

          setStatus(
            "Scan Completed Successfully ✅"
          );

          setShowResult(true);


        } catch (err) {

          console.error(err);

          alert("Scan failed.");

        }


        setLoading(false);

      }


    }, 200);

  };



  return (

    <div className="flex min-h-screen bg-[#020617] text-white">


      <Sidebar />


      <main className="flex-1 p-10">


        <h1 className="text-4xl font-bold text-cyan-400">

          Website Vulnerability Scanner

        </h1>



        <p className="mt-2 text-gray-400">

          Scan a website for security vulnerabilities.

        </p>





        <div className="mt-8 flex gap-4">


          <input

            type="text"

            placeholder="https://example.com"

            value={url}

            onChange={(e)=>setUrl(e.target.value)}

            className="flex-1 rounded-xl border border-cyan-500 bg-slate-900 p-4 outline-none focus:border-cyan-400"

          />




          <button

            onClick={startScan}

            className="rounded-xl bg-cyan-500 px-8 font-bold text-black transition hover:bg-cyan-400"

          >

            Start Scan

          </button>



        </div>






        {loading && (

          <div className="mt-10">


            <h2 className="mb-4 text-xl text-cyan-300">

              {status}

            </h2>




            <div className="h-4 overflow-hidden rounded-full bg-slate-800">


              <div

                className="h-full bg-cyan-400 transition-all duration-200"

                style={{
                  width:`${progress}%`
                }}

              />


            </div>




            <p className="mt-3 text-cyan-300">

              {progress}% Completed

            </p>




            <p className="mt-4 text-gray-400">

              Please wait while the scanner analyzes the target...

            </p>



          </div>

        )}








        {!loading && status && (

          <div className="mt-10 rounded-xl border border-cyan-500 bg-slate-900 p-5">


            <h2 className="text-2xl text-cyan-300">

              {status}

            </h2>


          </div>

        )}









        {showResult && result && (

          <>


            <div className="mt-10">


              <DashboardSummary

                score={result.securityScore}

                ssl={result.ssl}

              />


            </div>





            <ScanResult

              result={result}

            />



          </>

        )}



      </main>



    </div>

  );

}