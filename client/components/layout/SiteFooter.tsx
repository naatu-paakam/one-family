export default function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="container py-10 grid gap-6 md:grid-cols-3">
        <div>
          <a href="/" className="flex items-center gap-1.5">
            <img src="/logo.svg" alt="Family Vibes" className="h-7 w-7 rounded-md" />
            <span className="font-semibold">Family Vibes</span>
          </a>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm">
            Your family's home for stories and events together.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Features</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="/blogs" className="hover:underline">
                Stories
              </a>
            </li>
            <li>
              <a href="/events" className="hover:underline">
                Event invites & groups
              </a>
            </li>
            <li>
              <a href="/#ai" className="hover:underline">
                AI summaries
              </a>
            </li>
            <li>
              <a href="/family-tree" className="hover:underline">
                Interactive family tree
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Privacy</h4>
          <p className="mt-3 text-sm text-muted-foreground">
            Invite-only access. Export your data anytime.
          </p>
        </div>
      </div>
      <div className="border-t">
        <div className="container py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} NaatuPaakam · Built with ❤️ for the family
        </div>
      </div>
    </footer>
  );
}
