import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Ícone do app (rota `/icon`); `favicon.ico` redireciona para cá em `next.config.ts`. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 15,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1917",
          color: "#e7c56c",
          fontFamily: "system-ui, sans-serif",
          fontWeight: 700,
        }}
      >
        CP
      </div>
    ),
    { width: size.width, height: size.height }
  );
}
