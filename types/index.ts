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

// Legacy format (for D3ForceGraph)
export interface GraphNode {
  id: string; // document slug
  label: string; // document title
  size?: number; // 노드 크기 (backlinks 수에 따라)
  color?: string;
}

export interface GraphEdge {
  source: string | number; // source document slug or ID
  target: string | number; // target document slug or ID
}

// Digital Garden format
export interface DigitalGardenNode {
  id: number; // numeric ID
  title: string; // document title
  url: string; // document URL (e.g., "/getting-started")
  neighbors: string[]; // bidirectional connections
  backLinks: string[]; // incoming links
  size: number; // node size (2-7)
  color: string; // node color
  hide: boolean; // visibility flag
  tags?: string[]; // document tags
}

export interface Graph {
  nodes: { [url: string]: DigitalGardenNode } | GraphNode[]; // Support both formats
  links?: GraphEdge[]; // Digital Garden format
  edges?: GraphEdge[]; // Legacy format
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
