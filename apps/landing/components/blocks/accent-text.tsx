/** Wraps `accent` inside `text` in the accent colour (F8: colour, never underline). Falls back to the plain text when the phrase is absent. */
export function AccentText({ text, accent }: { text: string; accent: string }) {
  const at = text.indexOf(accent);
  if (at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-accent" data-accent="true">{accent}</span>
      {text.slice(at + accent.length)}
    </>
  );
}
