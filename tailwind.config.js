/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /* === Colors mapped to CSS variables === */
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: 'hsl(var(--surface))',
        'surface-muted': 'hsl(var(--surface-muted))',
        
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        error: 'hsl(var(--error))',
        
        border: 'hsl(var(--border))',
        focus: 'hsl(var(--focus))',
      },
      
      /* === Spacing scale === */
      spacing: {
        '0': 'var(--spacing-0)',
        '1': 'var(--spacing-1)',
        '2': 'var(--spacing-2)',
        '3': 'var(--spacing-3)',
        '4': 'var(--spacing-4)',
        '6': 'var(--spacing-6)',
        '8': 'var(--spacing-8)',
        '12': 'var(--spacing-12)',
        '16': 'var(--spacing-16)',
      },
      
      /* === Border Radius === */
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      
      /* === Elevation (Box Shadow) === */
      boxShadow: {
        'sm': 'var(--elevation-sm)',
        'md': 'var(--elevation-md)',
        'lg': 'var(--elevation-lg)',
      },
      
      /* === Typography === */
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      
      lineHeight: {
        tight: 'var(--line-height-tight)',
        normal: 'var(--line-height-normal)',
        relaxed: 'var(--line-height-relaxed)',
      },
      
      /* === Canonical Screens === */
      screens: {
        'mobile': '320px',
        'tablet': '768px',
        'desktop': '1024px',
      },
      
      /* === Animation/Motion === */
      transitionDuration: {
        'fast': 'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
      },
      
      transitionTimingFunction: {
        'standard': 'var(--easing-standard)',
        'emphasized': 'var(--easing-emphasized)',
      },

      /* === Javari Avatar Animations === */
      keyframes: {
        avatarIdle: {
          '0%, 100%': { 
            boxShadow: '0 0 10px rgba(79, 160, 255, 0.4)',
            transform: 'scale(1)'
          },
          '50%': { 
            boxShadow: '0 0 15px rgba(79, 160, 255, 0.6)',
            transform: 'scale(1.02)'
          },
        },
        avatarListening: {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgba(79, 209, 255, 0.8)',
            transform: 'scale(1.05)'
          },
          '50%': { 
            boxShadow: '0 0 35px rgba(79, 209, 255, 1)',
            transform: 'scale(1.08)'
          },
        },
        avatarThinking: {
          '0%, 100%': { 
            boxShadow: '0 0 25px rgba(127, 92, 255, 0.7)',
            transform: 'scale(1.03) rotate(-1deg)'
          },
          '50%': { 
            boxShadow: '0 0 40px rgba(127, 92, 255, 1)',
            transform: 'scale(1.06) rotate(1deg)'
          },
        },
        avatarSpeaking: {
          '0%, 100%': { 
            boxShadow: '0 0 25px rgba(76, 255, 122, 0.8)',
            transform: 'scale(1.04)'
          },
          '33%': { 
            boxShadow: '0 0 35px rgba(76, 255, 122, 1)',
            transform: 'scale(1.07)'
          },
          '66%': { 
            boxShadow: '0 0 30px rgba(76, 255, 122, 0.9)',
            transform: 'scale(1.05)'
          },
        },
        avatarError: {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgba(255, 76, 76, 0.8)',
            transform: 'scale(1) rotate(0deg)'
          },
          '25%': { 
            boxShadow: '0 0 30px rgba(255, 76, 76, 1)',
            transform: 'scale(1.05) rotate(-3deg)'
          },
          '75%': { 
            boxShadow: '0 0 30px rgba(255, 76, 76, 1)',
            transform: 'scale(1.05) rotate(3deg)'
          },
        },
      },
      animation: {
        avatarIdle: 'avatarIdle 3s ease-in-out infinite',
        avatarListening: 'avatarListening 1.5s ease-in-out infinite',
        avatarThinking: 'avatarThinking 2s ease-in-out infinite',
        avatarSpeaking: 'avatarSpeaking 0.8s ease-in-out infinite',
        avatarError: 'avatarError 0.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}