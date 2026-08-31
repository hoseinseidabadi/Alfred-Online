import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'میز درخواست‌های محصول',
  description: 'داشبورد ثبت و تصمیم‌گیری درخواست‌های محصول آخرین خبر',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
