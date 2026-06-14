interface OekonomiFootnoteProps {
  kilde?: string;
  opdateret?: string;
}

export function OekonomiFootnote({ kilde, opdateret }: OekonomiFootnoteProps) {
  if (!kilde && !opdateret) return null;

  return (
    <p className="mx-auto mt-10 max-w-2xl px-4 text-center text-[11px] leading-relaxed text-muted-foreground">
      {kilde && <>Kilde: {kilde}</>}
      {kilde && opdateret && ' — '}
      {opdateret && <>opdateret {opdateret}</>}
      . Realiseret = projekter faktisk anlagt (ikke skitser eller forundersøgelse alene), jf.
      MARS- og supplerende offentlige kilder. Rammebeløb er dels vejledende underopdelinger inden
      for den samlede politiske ramme.
    </p>
  );
}
