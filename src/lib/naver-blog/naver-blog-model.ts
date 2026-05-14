export type NaverBlogPost = {
  category?: string;
  createdAt: string;
  descriptionHtml: string;
  fetchedAt: string;
  guid: string;
  id: string;
  link: string;
  naverBlogId: string;
  publishedAt: string;
  summary: string;
  tags: string[];
  thumbnailUrl?: string;
  title: string;
  updatedAt: string;
};

export type NaverBlogPostInput = {
  category?: string;
  descriptionHtml: string;
  guid: string;
  link: string;
  naverBlogId: string;
  publishedAt: string;
  summary: string;
  tags: string[];
  thumbnailUrl?: string;
  title: string;
};

export type NaverBlogSyncSummary = {
  blogId: string;
  dryRun: boolean;
  feedTitle?: string;
  inserted: number;
  scanned: number;
  unchanged: number;
  updated: number;
};
