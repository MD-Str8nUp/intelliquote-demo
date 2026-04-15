'use client'

import { AppProvider } from '@/components/context'
import { AppShell } from '@/components/app-shell'

export default function Home() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
