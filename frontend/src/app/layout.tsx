import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import QueryProvider from '@/components/QueryProvider';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export const metadata: Metadata = {
  title: 'Roomies',
  description: 'Shared living made simple',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = (
    <QueryProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: '12px', fontFamily: 'Manrope, sans-serif', fontSize: '14px' },
        }}
      />
    </QueryProvider>
  );

  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {googleClientId ? (
          <GoogleOAuthProvider clientId={googleClientId}>{content}</GoogleOAuthProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}

