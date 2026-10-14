import { NextRequest, NextResponse } from "next/server";
import tls from "tls";
import net from "net";


// =====================================
// SSL Certificate Analyzer
// =====================================

function analyzeSSL(url: string): Promise<any> {

  return new Promise((resolve) => {

    try {

      const hostname = new URL(url).hostname;


      const socket = tls.connect(
        {
          host: hostname,
          port: 443,
          servername: hostname,
          rejectUnauthorized:false,
        },

        () => {


          const cert = socket.getPeerCertificate();

          const protocol = socket.getProtocol();


          socket.end();



          if(!cert || !cert.valid_from){

            resolve({

              enabled:false,
              valid:false,
              issuer:"Unknown",
              validFrom:"",
              validTo:"",
              daysRemaining:0,
              protocol:protocol || "Unknown",

            });

            return;

          }




          const validTo =
            new Date(cert.valid_to);



          const daysRemaining =
            Math.floor(
              (
                validTo.getTime()
                -
                Date.now()
              )
              /
              (
                1000 *
                60 *
                60 *
                24
              )
            );



          resolve({

            enabled:true,

            valid:
              daysRemaining > 0,


            issuer:
              cert.issuer?.O ||
              cert.issuer?.CN ||
              "Unknown",


            validFrom:
              new Date(cert.valid_from)
              .toISOString(),


            validTo:
              validTo.toISOString(),


            daysRemaining,


            protocol:
              protocol || "Unknown",

          });


        }

      );



      socket.on(
        "error",
        () => {

          resolve({

            enabled:false,
            valid:false,
            issuer:"Unknown",
            validFrom:"",
            validTo:"",
            daysRemaining:0,
            protocol:"Unknown",

          });

        }
      );


    }

    catch {

      resolve({

        enabled:false,
        valid:false,
        issuer:"Unknown",
        validFrom:"",
        validTo:"",
        daysRemaining:0,
        protocol:"Unknown",

      });

    }

  });

}





// =====================================
// Port Scanner
// =====================================


function checkPort(
  host:string,
  port:number
):Promise<boolean>{


  return new Promise((resolve)=>{


    const socket = new net.Socket();


    socket.setTimeout(1500);



    socket.once(
      "connect",
      ()=>{

        socket.destroy();

        resolve(true);

      }
    );



    socket.once(
      "timeout",
      ()=>{

        socket.destroy();

        resolve(false);

      }
    );



    socket.once(
      "error",
      ()=>{

        resolve(false);

      }
    );



    socket.connect(
      port,
      host
    );


  });

}




async function analyzePorts(url:string){


  const hostname =
    new URL(url).hostname;



  const commonPorts = [

    {
      port:443,
      service:"HTTPS",
      risk:"Low",
    },

    {
      port:80,
      service:"HTTP",
      risk:"Medium",
    },

    {
      port:22,
      service:"SSH",
      risk:"Review",
    },

    {
      port:21,
      service:"FTP",
      risk:"High",
    },

    {
      port:25,
      service:"SMTP",
      risk:"Medium",
    },

    {
      port:3306,
      service:"MySQL",
      risk:"High",
    },

    {
      port:5432,
      service:"PostgreSQL",
      risk:"High",
    },

  ];



  const results:any[] = [];



  for(
    const item of commonPorts
  ){

    const open =
      await checkPort(
        hostname,
        item.port
      );


    if(open){

      results.push({

        port:item.port,

        service:item.service,

        status:"Open",

        risk:item.risk,

      });

    }

  }


  return results;

}
// =====================================
// Scan API
// =====================================

export async function POST(req: NextRequest) {

  try {


    const { url } = await req.json();



    if (!url) {

      return NextResponse.json(
        {
          error:"URL is required"
        },
        {
          status:400
        }
      );

    }



    const start = Date.now();



    const response = await fetch(url, {

      method:"GET",

      redirect:"follow",

      cache:"no-store",

    });



    const responseTime =
      Date.now() - start;



    const headers =
      response.headers;





    // ===============================
    // SSL
    // ===============================


    const ssl =
      url.startsWith("https://")

      ?

      await analyzeSSL(url)

      :

      {

        enabled:false,

        valid:false,

        issuer:"Not HTTPS",

        validFrom:"",

        validTo:"",

        daysRemaining:0,

        protocol:"None",

      };





    // ===============================
    // PORT ANALYSIS
    // ===============================


    const ports =
      await analyzePorts(url);







    // ===============================
    // Security Headers
    // ===============================


    const securityHeaders = {


      hsts:
        headers.get(
          "strict-transport-security"
        ),


      csp:
        headers.get(
          "content-security-policy"
        ),


      xfo:
        headers.get(
          "x-frame-options"
        ),


      xcto:
        headers.get(
          "x-content-type-options"
        ),


      referrer:
        headers.get(
          "referrer-policy"
        ),


      permissions:
        headers.get(
          "permissions-policy"
        ),

    };




    const missingHeaders =

      Object.entries(securityHeaders)

      .filter(
        ([_,value])=>!value
      )

      .map(
        ([key])=>key
      );







    // ===============================
    // Cookies
    // ===============================


    const cookieHeader =
      headers.get("set-cookie")
      || "";



    const cookieAnalysis = {


      present:
        cookieHeader.length > 0,


      secure:
        cookieHeader
        .toLowerCase()
        .includes("secure"),


      httpOnly:
        cookieHeader
        .toLowerCase()
        .includes("httponly"),


      sameSite:

        cookieHeader.match(
          /samesite=(strict|lax|none)/i
        )?.[1]

        ||

        "Not Set",

    };







    // ===============================
    // CORS
    // ===============================


    const cors = {


      origin:
        headers.get(
          "access-control-allow-origin"
        ),


      credentials:
        headers.get(
          "access-control-allow-credentials"
        ),


      methods:
        headers.get(
          "access-control-allow-methods"
        ),


      headers:
        headers.get(
          "access-control-allow-headers"
        ),

    };



    let corsRisk="Safe";



    if(cors.origin==="*"){

      corsRisk="High";

    }

    else if(cors.origin){

      corsRisk="Medium";

    }








    // ===============================
    // Robots
    // ===============================


    let robots = {

      found:false,

      url:"",

      size:0,

      disallowCount:0,

      sitemap:false,

    };



    try {


      const robotsUrl =
        new URL(
          "/robots.txt",
          url
        ).toString();



      const robotsRes =
        await fetch(
          robotsUrl,
          {
            cache:"no-store"
          }
        );



      if(robotsRes.ok){


        const text =
          await robotsRes.text();



        robots = {


          found:true,


          url:robotsUrl,


          size:text.length,


          disallowCount:
            (
              text.match(/^Disallow:/gim)
              ||
              []
            )
            .length,


          sitemap:
            /Sitemap:/i.test(text),

        };

      }


    }

    catch {}







    // ===============================
    // Clickjacking
    // ===============================


    const clickjackingProtected =

      !!securityHeaders.xfo

      ||

      !!(
        securityHeaders.csp &&
        securityHeaders.csp.includes(
          "frame-ancestors"
        )
      );



    const clickjacking = {


      protected:
        clickjackingProtected,


      severity:
        clickjackingProtected
        ?
        "None"
        :
        "Medium",



      reason:

        clickjackingProtected

        ?

        "X-Frame-Options or CSP frame-ancestors is configured."

        :

        "No anti-framing protection detected.",

    };








    // ===============================
    // Security Score
    // ===============================


    let securityScore = 100;



    securityScore -=
      missingHeaders.length * 8;



    if(!clickjackingProtected){

      securityScore -= 15;

    }



    if(corsRisk==="High"){

      securityScore -= 10;

    }



    if(!cookieAnalysis.secure){

      securityScore -= 5;

    }



    if(securityScore < 0){

      securityScore = 0;

    }







    return NextResponse.json({

      url,


      status:
        response.status,


      responseTime,



      https:
        url.startsWith("https://"),



      server:
        headers.get("server")
        ||
        "Unknown",



      contentType:
        headers.get("content-type")
        ||
        "Unknown",



      poweredBy:
        headers.get("x-powered-by")
        ||
        "Hidden",



      cacheControl:
        headers.get("cache-control")
        ||
        "Not Set",



      contentLength:
        headers.get("content-length")
        ||
        "Unknown",



      securityHeaders,


      missingHeaders,


      securityScore,



      cookieAnalysis,



      cors:{
        ...cors,
        risk:corsRisk,
      },



      robots,



      clickjacking,



      ssl,



      // NEW FEATURE
      ports,

    });



  }


  catch {


    return NextResponse.json(

      {
        error:
          "Unable to scan target"
      },

      {
        status:500
      }

    );

  }

}