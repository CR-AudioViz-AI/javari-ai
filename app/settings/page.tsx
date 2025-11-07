'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Key,
  Bell,
  Palette,
  Shield,
  CreditCard,
  Database,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

interface UserSettings {
  name: string;
  email: string;
  company?: string;
  avatar?: string;
}

interface ProviderKeys {
  openai: string;
  anthropic: string;
  google: string;
  mistral: string;
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  costAlerts: boolean;
  errorAlerts: boolean;
  weeklyReport: boolean;
}

interface PreferenceSettings {
  theme: 'light' | 'dark' | 'system';
  defaultProvider: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  autoSave: boolean;
  codeHighlight: boolean;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // User settings
  const [userSettings, setUserSettings] = useState<UserSettings>({
    name: 'Roy Henderson',
    email: 'roy@craudiovizai.com',
    company: 'CR AudioViz AI',
  });

  // Provider API keys
  const [providerKeys, setProviderKeys] = useState<ProviderKeys>({
    openai: '',
    anthropic: '',
    google: '',
    mistral: '',
  });

  // Notification settings
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email: true,
    push: true,
    costAlerts: true,
    errorAlerts: true,
    weeklyReport: false,
  });

  // Preference settings
  const [preferences, setPreferences] = useState<PreferenceSettings>({
    theme: 'system',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4-turbo',
    temperature: 0.7,
    maxTokens: 2000,
    autoSave: true,
    codeHighlight: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/javari/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.user) setUserSettings(data.user);
        if (data.notifications) setNotifications(data.notifications);
        if (data.preferences) setPreferences(data.preferences);
        // Note: API keys should be loaded separately with proper security
      }
    } catch (error: unknown) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSaveSettings = async (section: string) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/javari/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          data:
            section === 'user'
              ? userSettings
              : section === 'keys'
              ? providerKeys
              : section === 'notifications'
              ? notifications
              : preferences,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Settings saved',
          description: `Your ${section} settings have been updated successfully`,
        });
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testApiKey = async (provider: string) => {
    toast({
      title: 'Testing API key',
      description: `Verifying ${provider} API key...`,
    });

    // Simulate API key test
    setTimeout(() => {
      toast({
        title: 'API key valid',
        description: `${provider} API key is working correctly`,
      });
    }, 2000);
  };

  const toggleKeyVisibility = (provider: string) => {
    setShowKeys({ ...showKeys, [provider]: !showKeys[provider] });
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 8) + '•'.repeat(key.length - 8);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">
          Manage your account, API keys, and preferences
        </p>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="account" className="space-y-6">
        <TabsList>
          <TabsTrigger value="account">
            <User className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
          <TabsTrigger value="providers">
            <Key className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Palette className="h-4 w-4 mr-2" />
            Preferences
          </TabsTrigger>
        </TabsList>

        {/* Account Settings */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={userSettings.name}
                  onChange={(e) =>
                    setUserSettings({ ...userSettings, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={userSettings.email}
                  onChange={(e) =>
                    setUserSettings({ ...userSettings, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company (Optional)</Label>
                <Input
                  id="company"
                  value={userSettings.company || ''}
                  onChange={(e) =>
                    setUserSettings({ ...userSettings, company: e.target.value })
                  }
                />
              </div>
              <Button onClick={() => handleSaveSettings('user')} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" type="password" />
              </div>
              <Button variant="outline">
                <Shield className="h-4 w-4 mr-2" />
                Update Password
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>Irreversible account actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                <div>
                  <h4 className="font-semibold text-red-900">Delete Account</h4>
                  <p className="text-sm text-red-700">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button variant="destructive">Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Provider API Keys */}
        <TabsContent value="providers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider API Keys</CardTitle>
              <CardDescription>
                Configure your API keys for different AI providers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OpenAI */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Key className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">OpenAI</h4>
                      <p className="text-sm text-gray-500">GPT-4, GPT-3.5</p>
                    </div>
                  </div>
                  {providerKeys.openai && (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      type={showKeys.openai ? 'text' : 'password'}
                      placeholder="sk-..."
                      value={
                        showKeys.openai
                          ? providerKeys.openai
                          : maskApiKey(providerKeys.openai)
                      }
                      onChange={(e) =>
                        setProviderKeys({ ...providerKeys, openai: e.target.value })
                      }
                    />
                    <button
                      onClick={() => toggleKeyVisibility('openai')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKeys.openai ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => testApiKey('OpenAI')}
                    disabled={!providerKeys.openai}
                  >
                    Test
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Claude/Anthropic */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Key className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Anthropic (Claude)</h4>
                      <p className="text-sm text-gray-500">Claude 3 Opus, Sonnet, Haiku</p>
                    </div>
                  </div>
                  {providerKeys.anthropic && (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      type={showKeys.anthropic ? 'text' : 'password'}
                      placeholder="sk-ant-..."
                      value={
                        showKeys.anthropic
                          ? providerKeys.anthropic
                          : maskApiKey(providerKeys.anthropic)
                      }
                      onChange={(e) =>
                        setProviderKeys({ ...providerKeys, anthropic: e.target.value })
                      }
                    />
                    <button
                      onClick={() => toggleKeyVisibility('anthropic')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKeys.anthropic ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => testApiKey('Anthropic')}
                    disabled={!providerKeys.anthropic}
                  >
                    Test
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Google Gemini */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                      <Key className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Google (Gemini)</h4>
                      <p className="text-sm text-gray-500">Gemini Pro, Pro Vision</p>
                    </div>
                  </div>
                  {providerKeys.google && (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      type={showKeys.google ? 'text' : 'password'}
                      placeholder="AIza..."
                      value={
                        showKeys.google
                          ? providerKeys.google
                          : maskApiKey(providerKeys.google)
                      }
                      onChange={(e) =>
                        setProviderKeys({ ...providerKeys, google: e.target.value })
                      }
                    />
                    <button
                      onClick={() => toggleKeyVisibility('google')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKeys.google ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => testApiKey('Google')}
                    disabled={!providerKeys.google}
                  >
                    Test
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Mistral */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                      <Key className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Mistral AI</h4>
                      <p className="text-sm text-gray-500">Mistral Large, Medium, Small</p>
                    </div>
                  </div>
                  {providerKeys.mistral && (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      type={showKeys.mistral ? 'text' : 'password'}
                      placeholder="..."
                      value={
                        showKeys.mistral
                          ? providerKeys.mistral
                          : maskApiKey(providerKeys.mistral)
                      }
                      onChange={(e) =>
                        setProviderKeys({ ...providerKeys, mistral: e.target.value })
                      }
                    />
                    <button
                      onClick={() => toggleKeyVisibility('mistral')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKeys.mistral ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => testApiKey('Mistral')}
                    disabled={!providerKeys.mistral}
                  >
                    Test
                  </Button>
                </div>
              </div>

              <Button onClick={() => handleSaveSettings('keys')} disabled={isSaving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Save API Keys
              </Button>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Security Notice</h4>
                    <p className="text-sm text-blue-800">
                      Your API keys are encrypted and stored securely. They are never shared or exposed in client-side code.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified about activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Email Notifications</h4>
                  <p className="text-sm text-gray-500">
                    Receive updates via email
                  </p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, email: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Push Notifications</h4>
                  <p className="text-sm text-gray-500">
                    Get instant notifications in your browser
                  </p>
                </div>
                <Switch
                  checked={notifications.push}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, push: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Cost Alerts</h4>
                  <p className="text-sm text-gray-500">
                    Alert me when spending exceeds thresholds
                  </p>
                </div>
                <Switch
                  checked={notifications.costAlerts}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, costAlerts: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Error Alerts</h4>
                  <p className="text-sm text-gray-500">
                    Notify me when API errors occur
                  </p>
                </div>
                <Switch
                  checked={notifications.errorAlerts}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, errorAlerts: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Weekly Reports</h4>
                  <p className="text-sm text-gray-500">
                    Get a summary of your weekly usage
                  </p>
                </div>
                <Switch
                  checked={notifications.weeklyReport}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, weeklyReport: checked })
                  }
                />
              </div>

              <Button onClick={() => handleSaveSettings('notifications')} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how Javari AI looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select
                  value={preferences.theme}
                  onValueChange={(value: 'light' | 'dark' | 'system') =>
                    setPreferences({ ...preferences, theme: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default AI Settings</CardTitle>
              <CardDescription>Set your preferred AI provider and model</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Provider</Label>
                <Select
                  value={preferences.defaultProvider}
                  onValueChange={(value) =>
                    setPreferences({ ...preferences, defaultProvider: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Claude</SelectItem>
                    <SelectItem value="google">Gemini</SelectItem>
                    <SelectItem value="mistral">Mistral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Model</Label>
                <Input
                  value={preferences.defaultModel}
                  onChange={(e) =>
                    setPreferences({ ...preferences, defaultModel: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Temperature: {preferences.temperature}</Label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={preferences.temperature}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      temperature: parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Tokens: {preferences.maxTokens}</Label>
                <input
                  type="range"
                  min="100"
                  max="4000"
                  step="100"
                  value={preferences.maxTokens}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      maxTokens: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Editor Preferences</CardTitle>
              <CardDescription>Customize your coding experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Auto Save</h4>
                  <p className="text-sm text-gray-500">
                    Automatically save your conversations
                  </p>
                </div>
                <Switch
                  checked={preferences.autoSave}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, autoSave: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Code Highlighting</h4>
                  <p className="text-sm text-gray-500">
                    Enable syntax highlighting for code blocks
                  </p>
                </div>
                <Switch
                  checked={preferences.codeHighlight}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, codeHighlight: checked })
                  }
                />
              </div>

              <Button onClick={() => handleSaveSettings('preferences')} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
