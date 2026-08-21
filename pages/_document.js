import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="icon" type="image/png" href="/api/favicon?v=3" />
        <link rel="apple-touch-icon" href="/api/apple-touch-icon?v=3" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
