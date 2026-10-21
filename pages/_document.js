import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="icon" type="image/png" href="/api/favicon?v=3" />
        <link rel="apple-touch-icon" href="/api/apple-touch-icon?v=3" />
        {/* Open Sans, linked here rather than @import-ed from globals.css: the
            browser finds it with the page instead of only after downloading
            and parsing the stylesheet, and the preconnects open both Google
            Fonts hosts up front. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
