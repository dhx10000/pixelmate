import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// 32×32 dark square with a centred green dot — matches the in-app logo mark.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          background: "#0A0A0C",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "8px",
            background: "#C8F560",
          }}
        />
      </div>
    ),
    { width: 32, height: 32 }
  );
}
