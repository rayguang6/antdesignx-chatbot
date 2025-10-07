// app/layout.tsx
import type { Metadata } from "next";
import "antd/dist/reset.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, theme } from "antd";

export const metadata: Metadata = {
  title: "Ant Design X — bricks",
  description: "Rebuild the X demo step-by-step",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
