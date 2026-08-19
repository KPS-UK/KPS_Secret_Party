import './globals.css';
import LogoutButton from './LogoutButton';

export const metadata = {
  title: 'KPS Secret Party - check in',
  description: 'Check in for the KPS Secret Party',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Playball&family=Orbitron:wght@700&family=Rajdhani:wght@600&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LogoutButton />
        {children}
      </body>
    </html>
  );
}