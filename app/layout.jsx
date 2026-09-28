import './globals.css';

export const metadata = {
  title: 'Guideline Desk — Mortgage research',
  description: 'Grounded mortgage guideline research across Fannie Mae and Freddie Mac.',
  icons: {
    icon: '/icon.png'
  }
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
