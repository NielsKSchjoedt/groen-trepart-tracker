export interface VidenscenterArticle {
  slug: string;
  title: string;
  section: string;
  summary: string;
  body: string;
}

export interface VidenscenterIndex {
  generated: string;
  count: number;
  note: string;
  articles: VidenscenterArticle[];
}

let cachedIndex: VidenscenterIndex | null = null;

export async function loadVidenscenterArticles(): Promise<VidenscenterIndex> {
  if (cachedIndex) return cachedIndex;
  const res = await fetch('/data/videnscenter/articles.json');
  if (!res.ok) throw new Error(`videnscenter articles: ${res.status}`);
  cachedIndex = await res.json();
  return cachedIndex!;
}

export function groupArticlesBySection(
  articles: VidenscenterArticle[],
): Map<string, VidenscenterArticle[]> {
  const map = new Map<string, VidenscenterArticle[]>();
  for (const article of articles) {
    const list = map.get(article.section) ?? [];
    list.push(article);
    map.set(article.section, list);
  }
  return map;
}

export function findArticleBySlug(
  articles: VidenscenterArticle[],
  slug: string,
): VidenscenterArticle | undefined {
  return articles.find((a) => a.slug === slug);
}
