// Document types

export interface Document {
  slug: string; // 파일명 (예: "getting-started")
  filePath: string; // 상대 경로 (예: "notes/getting-started.md")
  title: string; // frontmatter의 title 또는 첫 번째 # 헤더
  content: string; // 전체 마크다운 텍스트 (frontmatter 포함)
  contentWithoutFrontmatter: string; // frontmatter 제거된 본문
  frontmatter: Frontmatter; // frontmatter 데이터
  links: string[]; // 이 문서가 링크하는 다른 문서 slug들
  backlinks: string[]; // 이 문서를 링크하는 문서 slug들 (계산됨)
  createdAt: Date; // 파일 생성 시간
  updatedAt: Date; // 파일 수정 시간
}

export interface Frontmatter {
  title?: string;
  tags?: string[];
  [key: string]: any; // 기타 커스텀 필드
}

// Graph types

export interface GraphNode {
  id: string; // document slug
  label: string; // document title
  size?: number; // 노드 크기 (backlinks 수에 따라)
  color?: string;
}

export interface GraphEdge {
  source: string; // source document slug
  target: string; // target document slug
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// API Response types

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export interface DocumentResponse {
  document: Document;
}

// Settings types

export interface AppSettings {
  vercelToken?: string; // Vercel 배포용 토큰
  geminiApiKey?: string; // AI 기능용 (추후)
  theme: 'light' | 'dark' | 'system';
  graphLayout: 'force' | 'tree';
}

// Publish types (추후 구현)

export interface PublishConfig {
  enabled: boolean;
  deploymentUrl?: string;
  lastPublishedAt?: Date;
}
