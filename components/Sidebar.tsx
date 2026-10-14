"use client";

import { useRouter } from "next/navigation";

export default function Sidebar() {

  const router = useRouter();


  const menus = [
    {
      name: "Dashboard",
      path: "/",
    },
    {
      name: "New Scan",
      path: "/scanner",
    },
    {
      name: "History",
      path: "/history",
    },
    {
      name: "Reports",
      path: "/reports",
    },
    {
      name: "Settings",
      path: "/settings",
    },
  ];



  return (

    <aside className="relative w-64 min-h-screen border-r border-slate-800 bg-slate-950">


      <div className="border-b border-slate-800 p-6">

        <h1 className="text-3xl font-bold text-cyan-400">
          VAPT Scanner
        </h1>


        <p className="mt-2 text-sm text-gray-400">
          Security Assessment Dashboard
        </p>

      </div>




      <nav className="p-4">


        {menus.map((item,index)=>(


          <button

            key={index}

            onClick={() => router.push(item.path)}

            className={`mb-3 w-full rounded-xl px-5 py-4 text-left transition

            ${
              index === 0
              ? "bg-cyan-500 text-black font-bold"
              : "bg-slate-900 text-white hover:bg-slate-800"
            }

            `}

          >

            {item.name}

          </button>


        ))}


      </nav>





      <div className="absolute bottom-6 left-4 right-4">


        <div className="rounded-xl border border-cyan-500 bg-slate-900 p-4">


          <p className="text-sm text-gray-400">
            Version
          </p>


          <h2 className="mt-2 text-xl font-bold text-cyan-400">
            2.0
          </h2>


        </div>


      </div>



    </aside>

  );

}