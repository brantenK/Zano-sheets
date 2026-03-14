/**
 * Skip navigation links for accessibility
 * Allows keyboard users to skip to main content, settings, etc.
 */

interface SkipLinkProps {
  targetId: string;
  children: React.ReactNode;
}

export function SkipLink({ targetId, children }: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-(--chat-bg) focus:border-2 focus:border-(--chat-accent) focus:text-(--chat-text-primary) focus:rounded focus:text-sm focus:font-medium"
    >
      {children}
    </a>
  );
}

export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <SkipLink targetId="chat-input">Skip to chat input</SkipLink>
      <SkipLink targetId="settings-panel">Skip to settings</SkipLink>
      <SkipLink targetId="message-list">Skip to messages</SkipLink>
    </div>
  );
}
