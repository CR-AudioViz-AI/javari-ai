'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, ArrowLeft, Mail, Smartphone, MessageSquare } from 'lucide-react'

export default function NotificationsPage() {
  const [settings, setSettings] = useState({
    email_notifications: true,
    push_notifications: true,
    marketing_emails: false
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
          email_notifications: data.email_notifications ?? true,
          push_notifications: data.push_notifications ?? true,
          marketing_emails: data.marketing_emails ?? false
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
        setMessage({type: 'success', text: 'Notification settings updated!'})
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/settings" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1"/>Back to Settings
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-purple-600"/>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-600">Manage how you receive notifications</p>
            </div>
          </div>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type==='success'?'bg-green-50 border border-green-200 text-green-800':'bg-red-50 border border-red-200 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-blue-600"/>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Email Notifications</h3>
              <p className="text-sm text-gray-600 mb-4">Receive important updates and alerts via email</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.email_notifications} onChange={(e)=>setSettings({...settings,email_notifications:e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"/>
                <span className="text-sm font-medium text-gray-900">{settings.email_notifications?'Enabled':'Disabled'}</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-green-600"/>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Push Notifications</h3>
              <p className="text-sm text-gray-600 mb-4">Get real-time notifications on your devices</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.push_notifications} onChange={(e)=>setSettings({...settings,push_notifications:e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"/>
                <span className="text-sm font-medium text-gray-900">{settings.push_notifications?'Enabled':'Disabled'}</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-orange-600"/>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Marketing Communications</h3>
              <p className="text-sm text-gray-600 mb-4">Receive product updates, tips, and special offers</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.marketing_emails} onChange={(e)=>setSettings({...settings,marketing_emails:e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"/>
                <span className="text-sm font-medium text-gray-900">{settings.marketing_emails?'Enabled':'Disabled'}</span>
              </label>
            </div>
          </div>
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
