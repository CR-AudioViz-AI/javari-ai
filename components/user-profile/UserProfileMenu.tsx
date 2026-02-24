'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  User, 
  Globe, 
  BookOpen, 
  CreditCard, 
  Settings, 
  FolderOpen, 
  Shield, 
  LogOut,
  Check
} from 'lucide-react';
import { useUserProfile } from './user-profile-context';

// ============================================================================
// USER PROFILE MENU - Dropdown menu from bottom left
// ============================================================================

interface UserProfileMenuProps {
  onClose: () => void;
}

export function UserProfileMenu({ onClose }: UserProfileMenuProps) {
  const { profile, language, setLanguage } = useUserProfile();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      window.location.href = '/';
    } catch (error: unknown) {
      console.error('Sign out failed:', error);
    }
  };

  const menuItems = [
    {
      icon: <BookOpen className="w-4 h-4" />,
      label: language === 'en' ? 'Get Help' : 'Obtener Ayuda',
      href: '/help'
    },
    {
      icon: <CreditCard className="w-4 h-4" />,
      label: language === 'en' ? 'View Plans & Credits' : 'Ver Planes y Créditos',
      href: '/plans'
    },
    {
      icon: <Settings className="w-4 h-4" />,
      label: language === 'en' ? 'Settings' : 'Configuración',
      href: '/settings'
    },
    {
      icon: <FolderOpen className="w-4 h-4" />,
      label: language === 'en' ? 'Assets & Documents' : 'Activos y Documentos',
      href: '/assets'
    },
    {
      icon: <Shield className="w-4 h-4" />,
      label: language === 'en' ? 'Security & Keys' : 'Seguridad y Claves',
      href: '/settings/security'
    }
  ];

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
      {/* User Info */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
            {profile?.name.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">
              {profile?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {profile?.email || ''}
            </p>
          </div>
        </div>
      </div>

      {/* Language Selector */}
      <div className="px-2 py-1 border-b border-gray-100">
        <button
          onClick={() => setShowLanguageMenu(!showLanguageMenu)}
          className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 rounded-md transition-colors"
        >
          <Globe className="w-4 h-4 text-gray-600" />
          <span className="flex-1 text-left text-sm text-gray-700">
            {language === 'en' ? 'Language: English' : 'Idioma: Español'}
          </span>
          <span className="text-xs text-gray-400">▼</span>
        </button>

        {showLanguageMenu && (
          <div className="mt-1 ml-7 space-y-1">
            <button
              onClick={() => {
                setLanguage('en');
                setShowLanguageMenu(false);
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 rounded-md text-sm"
            >
              <span className={language === 'en' ? 'font-medium text-blue-600' : 'text-gray-700'}>
                English
              </span>
              {language === 'en' && <Check className="w-4 h-4 text-blue-600" />}
            </button>
            <button
              onClick={() => {
                setLanguage('es');
                setShowLanguageMenu(false);
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 rounded-md text-sm"
            >
              <span className={language === 'es' ? 'font-medium text-blue-600' : 'text-gray-700'}>
                Español
              </span>
              {language === 'es' && <Check className="w-4 h-4 text-blue-600" />}
            </button>
          </div>
        )}
      </div>

      {/* Menu Items */}
      <div className="px-2 py-1">
        {menuItems.map((item, index) => (
          <Link
            key={index}
            href={item.href}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
          >
            <span className="text-gray-600">{item.icon}</span>
            <span className="text-sm text-gray-700">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Sign Out */}
      <div className="px-2 pt-1 border-t border-gray-100 mt-1">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-50 rounded-md transition-colors text-red-600"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">
            {language === 'en' ? 'Sign Out' : 'Cerrar Sesión'}
          </span>
        </button>
      </div>
    </div>
  );
}
