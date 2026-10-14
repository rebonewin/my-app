type SSL = {
  enabled: boolean;
  valid: boolean;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  protocol: string;
};


type Props = {
  score: number;
  ssl: SSL;
};



export default function DashboardSummary({
  score,
  ssl,
}: Props) {


  const grade =
    score >= 95
      ? "A+"
      : score >= 90
      ? "A"
      : score >= 80
      ? "B"
      : score >= 70
      ? "C"
      : "D";



  const critical = score < 60 ? 2 : 0;
  const high = score < 75 ? 2 : 1;
  const medium = score < 90 ? 3 : 1;
  const low = 4;



  return (

    <div className="grid grid-cols-2 gap-5 lg:grid-cols-6">


      <div className="rounded-2xl bg-slate-900 border border-cyan-500 p-6">

        <p className="text-gray-400">
          Security Score
        </p>

        <h2 className="mt-3 text-5xl font-bold text-cyan-400">
          {score}
        </h2>

      </div>




      <div className="rounded-2xl bg-slate-900 border border-cyan-500 p-6">

        <p className="text-gray-400">
          Grade
        </p>

        <h2 className="mt-3 text-5xl font-bold text-green-400">
          {grade}
        </h2>

      </div>





      <div className="rounded-2xl bg-red-950 border border-red-500 p-6">

        <p className="text-red-300">
          Critical
        </p>

        <h2 className="mt-3 text-5xl font-bold text-red-400">
          {critical}
        </h2>

      </div>





      <div className="rounded-2xl bg-orange-950 border border-orange-500 p-6">

        <p className="text-orange-300">
          High
        </p>

        <h2 className="mt-3 text-5xl font-bold text-orange-400">
          {high}
        </h2>

      </div>






      <div className="rounded-2xl bg-yellow-950 border border-yellow-500 p-6">

        <p className="text-yellow-300">
          Medium
        </p>

        <h2 className="mt-3 text-5xl font-bold text-yellow-400">
          {medium}
        </h2>

      </div>







      {/* SSL CARD */}

      <div
        className={`rounded-2xl p-6 border ${
          ssl.valid
          ? "bg-green-950 border-green-500"
          : "bg-red-950 border-red-500"
        }`}
      >


        <p className="text-gray-300">
          SSL Certificate
        </p>



        <h2
          className={`mt-3 text-3xl font-bold ${
            ssl.valid
            ? "text-green-400"
            : "text-red-400"
          }`}
        >

          {ssl.valid ? "VALID" : "INVALID"}

        </h2>



        <p className="mt-3 text-sm text-gray-300">
          {ssl.daysRemaining} days remaining
        </p>



        <p className="mt-2 text-xs text-gray-400">
          {ssl.protocol}
        </p>


      </div>



    </div>

  );

}