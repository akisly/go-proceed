type MarkerTextProps = {
  accent: string;
  text: string;
};

export function MarkerText({ accent, text }: MarkerTextProps) {
  const accentStart = text.indexOf(accent);

  if (accentStart === -1) {
    return text;
  }

  const beforeAccent = text.slice(0, accentStart);
  const afterAccent = text.slice(accentStart + accent.length);

  return (
    <>
      {beforeAccent}
      <span className="landing-marker-accent" data-marker-accent="true">
        {accent}
      </span>
      {afterAccent}
    </>
  );
}
