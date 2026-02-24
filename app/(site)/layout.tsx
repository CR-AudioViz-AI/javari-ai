import { TopNav, MobileNav } from '@/components/navigation'

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <a 
        href="#main-content" 
        className="absolute -left-[9999px] z-[999] p-4 bg-primary text-primary-foreground no-underline rounded-md focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      
      <header role="banner">
        {/* Header placeholder */}
      </header>
      
      <TopNav />
      <MobileNav />
      
      <main role="main" id="main-content">
        {children}
      </main>
      
      <footer role="contentinfo">
        {/* Footer placeholder */}
      </footer>
    </>
  )
}
