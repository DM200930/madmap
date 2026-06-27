import type { Metadata } from 'next'
import './globals.css'
import PacketBackdrop from '@/components/PacketBackdrop'

export const metadata: Metadata = {
  title: 'MadMap — Every Scan Puts MadMix on the Map',
  description: 'Gamified consumer intelligence platform for MadMix. Scan your QR code, earn rewards, and help bring MadMix to your area.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <PacketBackdrop />
        <div className="relative z-10 flex flex-col min-h-screen">{children}</div>
      </body>
    </html>
  )
}
