export type Article = {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  publishedAt: string | null;
  implications: string | null;
  entities: string[];
  topics: string[];
  categories: string[];
  opportunities: string[];
  forShareholders: string | null;
  forInvestors: string | null;
  forBusiness: string | null;
  source: { name: string };
};
