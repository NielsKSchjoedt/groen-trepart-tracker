import { Link } from 'react-router-dom';
import { Leaf, Github, Heart, BookOpen } from 'lucide-react';

const REPO_URL = 'https://github.com/NielsKSchjoedt/groen-trepart-tracker';

interface FooterProps {
  fetchedAt: string;
}

export function Footer({ fetchedAt }: FooterProps) {
  const date = new Date(fetchedAt);
  const formatted = date.toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <footer className="w-full border-t border-border py-10 mt-16 bg-card/50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Leaf className="w-5 h-5 text-primary -scale-x-100" strokeWidth={1.5} />
          <span className="text-xs font-medium uppercase tracking-widest text-primary">
            Track Den Grønne Trepart
          </span>
          <Leaf className="w-5 h-5 text-primary" strokeWidth={1.5} />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="text-center md:text-left space-y-1">
            <p>
              Data fra{' '}
              <a
                href="https://mars.sgav.dk"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30"
              >
                MARS (Multifunktionel ArealRegistrering)
              </a>
            </p>
            <p>Sidst opdateret: {formatted}</p>
          </div>
          <div className="text-center md:text-right space-y-1">
            <p className="flex items-center justify-center md:justify-end gap-4">
              <Link
                to="/data-og-metode"
                className="inline-flex items-center gap-1.5 underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Data & metode
              </Link>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30"
              >
                <Github className="w-3.5 h-3.5" />
                GitHub
              </a>
            </p>
          </div>
        </div>

        <hr className="my-6 border-border/50" />

        <div className="text-center text-xs text-muted-foreground/80 space-y-4 max-w-2xl mx-auto">
          <p>
            Data stammer fra offentlige registre og er fortolket efter bedste evne. Der kan forekomme
            fejl eller unøjagtigheder — ingen af dem er tilsigtede. Hvis du opdager en fejl eller har
            faglig indsigt, er du meget velkommen til at{' '}
            <a
              href={`${REPO_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30"
            >
              oprette et issue
            </a>{' '}
            eller{' '}
            <a
              href={`${REPO_URL}/pulls`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30"
            >
              sende en pull request
            </a>.
          </p>

          <p className="flex items-center justify-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-primary/60" strokeWidth={1.5} />
            <span>
              Tak til de mange dedikerede medarbejdere i kommuner, vandoplandsstyregrupper og
              Miljøstyrelsen, som dagligt registrerer, kvalitetssikrer og vedligeholder data
              i de offentlige registre — uden deres omhyggelige arbejde ville denne side ikke
              være mulig.
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
