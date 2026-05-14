export type ClassReviewImage = {
  alt: string;
  height: number;
  id: string;
  src: string;
  width: number;
};

export type ClassReviewEntry = {
  body: string;
  classSessionId: string | null;
  classTitle: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  images: ClassReviewImage[];
};

export type ClassReviewSession = {
  dateLabel: string | null;
  id: string;
  sessionDate: string | null;
  title: string;
};
