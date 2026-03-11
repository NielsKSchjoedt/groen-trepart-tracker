import { Leaf } from 'lucide-react';

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
        <div className="flex items-center justify-center gap-1.5 mb-6">
          <Leaf className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium uppercase tracking-widest text-primary">
            Den Grønne Trepart
          </span>
          <Leaf className="w-4 h-4 text-primary" />
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="text-center md:text-left space-y-1">
            <p>
              Data fra{' '}
              <a
                href="https://mars.mst.dk"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30"
              >
                MARS (Miljøstyrelsens Arealregister)
              </a>
            </p>
            <p>Sidst opdateret: {formatted}</p>
          </div>
          <div className="text-center md:text-right space-y-1">
            <p>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30"
              >
                GitHub
              </a>
            </p>
            <p>Et open source projekt af Niels Kristian Schjødt</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
