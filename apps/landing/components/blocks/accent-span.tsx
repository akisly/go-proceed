/**
 * A static accent inside a card heading. The card's h3 is NOT a `.lines`
 * heading in the prototype (l.826): the card itself enters, the accent is still.
 */
export function AccentSpan({ text, accent }: { text: string; accent: string }) {
  const at = text.indexOf(accent);
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<span className="text-accent" data-accent="true">{accent}</span>{text.slice(at + accent.length)}</>;
}
