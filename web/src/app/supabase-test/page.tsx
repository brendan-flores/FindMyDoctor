'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SupabaseTestPage() {
  const [status, setStatus] = useState('Testing Supabase connection...')

  useEffect(() => {
    async function testConnection() {
      const { error } = await supabase.auth.getSession()

      if (error) {
        setStatus(`Supabase connection failed: ${error.message}`)
        return
      }

      setStatus('Supabase connection successful!')
    }

    testConnection()
  }, [])

  return (
    <main style={{ padding: '40px' }}>
      <h1>Supabase Connection Test</h1>
      <p>{status}</p>
    </main>
  )
}