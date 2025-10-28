'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Palette, ArrowLeft, Sun, Moon, Monitor } from 'lucide-react'

export default function AppearancePage() {
  const [settings, setSettings] = useState({
    theme: 'system',
    compact_mode: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success'|'error', text: string}|null>(null)

  useEffect(() => { fetchSettings() }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/user/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings({
          theme: data.theme || 'system',
          compact_mode: data.compact_mode ?? false
        })
      }
    } catch (error) {
      console.error('Failed to fetch:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(settings)
      })
      if (res.ok) {
        setMessage({type: 'success', text: 'Appearance settings updated!'})
      } else {
        const error = await res.json()
        setMessage({type: 'error', text: error.error || 'Failed to update'})
      }
    } catch (error) {
      setMessage({type: 'error', text: 'An error occurred'})
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8"><div className="max-w-4xl mx-auto"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/3"></div><div className="h-64 bg-gray-200 rounded"></div></div></div></div>
  }

  const themes = [
    {id: 'light', name: 'Light', icon: Sun, desc: 'Bright and clean interface'},
    {id: 'dark', name: 'Dark', icon: Moon, desc: 'Easy on the eyes'},
    {id: 'system', name: 'System', icon: Monitor, desc: 'Follows your system preference'}
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/settings" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1"/>Back to Settings
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
              <Palette className="w-6 h-6 text-pink-600"/>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Appearance</h1>
              <p className="text-gray-600">Customize how Javari AI looks</p>
            </div>
          </div>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type==='success'?'bg-green-50 border border-green-200 text-green-800':'bg-red-50 border border-red-200 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Theme</h3>
          <p className="text-sm text-gray-600 mb-4">Choose your preferred color theme</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSettings({...settings, theme: theme.id})}
                className={`p-6 rounded-xl border-2 transition-all ${
                  settings.theme === theme.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${
                    settings.theme === theme.id ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <theme.icon className={`w-6 h-6 ${settings.theme === theme.id ? 'text-blue-600' : 'text-gray-600'}`}/>
                  </div>
                  <div className="font-semibold text-gray-900">{theme.name}</div>
                  <div className="text-sm text-gray-500 mt-1">{theme.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-1">Display Density</h3>
          <p className="text-sm text-gray-600 mb-4">Adjust the spacing and size of UI elements</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.compact_mode} onChange={(e)=>setSettings({...settings,compact_mode:e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"/>
            <div>
              <div className="text-sm font-medium text-gray-900">Compact Mode</div>
              <div className="text-sm text-gray-500">Show more content with tighter spacing</div>
            </div>
          </label>
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-semibold transition-colors">
            {saving?'Saving...':'Save Changes'}
          </button>
          <Link href="/settings" className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-semibold transition-colors">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
