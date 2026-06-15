import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, ChevronRight, ArrowLeft } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { ViewSwitcher } from '@/components/ViewSwitcher';
import { MarkdownContent } from '@/components/MarkdownContent';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  loadVidenscenterArticles,
  groupArticlesBySection,
  findArticleBySlug,
  type VidenscenterArticle,
  type VidenscenterIndex,
} from '@/lib/videnscenter';

const INDEX_DESCRIPTION =
  'Videnscenter om Den Grønne Trepart: forklaring af aftalens fem mål, virkemidlerne, ' +
  'geografi og organisering, samt hvordan trackeren måler fremdrift. Neutralt baggrundsstof.';

export default function VidenscenterPage() {
  const { articleSlug } = useParams<{ articleSlug?: string }>();
  const [index, setIndex] = useState<VidenscenterIndex | null>(null);
  const [error, setError] = useState<string | null>(null);

  const article = useMemo(
    () => (index && articleSlug ? findArticleBySlug(index.articles, articleSlug) : undefined),
    [index, articleSlug],
  );

  const sections = useMemo(
    () => (index ? groupArticlesBySection(index.articles) : new Map<string, VidenscenterArticle[]>()),
    [index],
  );

  usePageMeta({
    title: article ? article.title : 'Videnscenter',
    description: article ? article.summary || `${article.title} — baggrund om Den Grønne Trepart.` : INDEX_DESCRIPTION,
    path: article ? `/videnscenter/${article.slug}` : '/videnscenter',
  });

  useEffect(() => {
    loadVidenscenterArticles()
      .then(setIndex)
      .catch(() => setError('Kunne ikke hente videnscenter-artikler.'));
  }, []);

  // Scroll to top when navigating between articles via in-app crosslinks.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [articleSlug]);

  return (
    <div className="min-h-screen bg-background">
      <ViewSwitcher />

      <main className="max-w-3xl mx-auto px-4 py-10 md:py-14">
        {articleSlug && article ? (
          <ArticleView article={article} />
        ) : articleSlug && !article && index ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">Artiklen findes ikke.</p>
            <Link to="/videnscenter" className="text-primary underline underline-offset-2">
              Tilbage til videnscenter
            </Link>
          </div>
        ) : error ? (
          <p className="text-destructive text-center py-16">{error}</p>
        ) : !index ? (
          <p className="text-muted-foreground text-center py-16">Indlæser…</p>
        ) : (
          <IndexView sections={sections} />
        )}
      </main>

      <Footer fetchedAt={index?.generated ?? new Date().toISOString()} />
    </div>
  );
}

function IndexView({ sections }: { sections: Map<string, VidenscenterArticle[]> }) {
  return (
    <>
      <header className="mb-10">
        <div className="flex items-center gap-2 text-primary mb-3">
          <BookOpen className="w-5 h-5" strokeWidth={1.5} />
          <span className="text-xs font-medium uppercase tracking-widest">Videnscenter</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight mb-3">
          Baggrund om Den Grønne Trepart
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Neutrale baggrundsartikler om aftalen, dens mål, virkemidlerne og hvordan trackeren måler
          fremdrift. Skrevet ud fra offentlige kilder for at gøre tallene i trackeren forståelige.
        </p>
      </header>

      <div className="space-y-10">
        {[...sections.entries()].map(([section, articles]) => (
          <section key={section}>
            <h2 className="text-lg font-semibold text-foreground mb-3 border-b border-border pb-2">
              {section}
            </h2>
            <ul className="space-y-2">
              {articles.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={`/videnscenter/${a.slug}`}
                    className="group flex items-start justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {a.title}
                      </span>
                      {a.summary && (
                        <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                          {a.summary}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function ArticleView({ article }: { article: VidenscenterArticle }) {
  return (
    <>
      <Link
        to="/videnscenter"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Videnscenter
      </Link>

      <p className="text-xs uppercase tracking-widest text-primary mb-2">{article.section}</p>
      <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-6">{article.title}</h1>

      <article className="rounded-2xl border border-border/60 bg-card/30 px-5 py-6 md:px-8 md:py-8">
        <MarkdownContent skipTitle={article.title}>{article.body}</MarkdownContent>
      </article>

      <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
        Skrevet af Grøn Trepart Tracker ud fra offentlige kilder. Kilder er angivet nederst i
        artiklen. Indholdet er neutralt baggrundsstof — vurderinger af fremdrift fremgår af selve
        trackeren.
      </p>
    </>
  );
}
