import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SiteTech AI | Data Licensing Opportunities for the Built Environment";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#000000",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              backgroundColor: "#ffffff",
              color: "#000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              fontWeight: 600,
              borderRadius: "2px",
            }}
          >
            S
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: "26px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            SiteTech AI
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#ffffff",
              fontSize: "58px",
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              maxWidth: "980px",
            }}
          >
            Your project files could be your next revenue stream.
          </div>
          <div
            style={{
              marginTop: "32px",
              color: "#a3a3a3",
              fontSize: "26px",
              lineHeight: 1.35,
              maxWidth: "880px",
            }}
          >
            Explore whether a permitted collection could support an AI data
            opportunity—starting with an eight-question fit check.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
