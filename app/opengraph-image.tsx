import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SiteTech AI | AI for the real world of real estate";
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
              borderRadius: "8px",
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
              fontSize: "76px",
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: "900px",
            }}
          >
            AI for the real world of real estate.
          </div>
          <div
            style={{
              marginTop: "32px",
              color: "#a3a3a3",
              fontSize: "30px",
              lineHeight: 1.3,
              maxWidth: "880px",
            }}
          >
            Custom, governed AI workflows built and maintained by forward-deployed AI
            engineers.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
