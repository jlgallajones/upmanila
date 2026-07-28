import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#7B1113" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="DCMS" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/icons/dcms-icon-180.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="167x167"
          href="/icons/dcms-icon-167.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="/icons/dcms-icon-152.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="120x120"
          href="/icons/dcms-icon-120.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="64x64"
          href="/icons/dcms-icon-64.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/icons/dcms-icon-32.png"
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
