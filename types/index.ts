// Document types

export interface Document {
  slug: string; // 파일명 (예: "getting-started")
  filePath: string; // 상대 경로 (예: "notes/default/getting-started.md")
  title: string; // frontmatter의 title 또는 첫 번째 # 헤더
  folder: string; // 폴더명 (예: "default", "work")
  content: string; // 전체 마크다운 텍스트 (frontmatter 포함)
  contentWithoutFrontmatter: string; // frontmatter 제거된 본문
  frontmatter: Frontmatter; // frontmatter 데이터
  links: string[]; // 이 문서가 링크하는 다른 문서 제목들
  backlinks: string[]; // 이 문서를 링크하는 문서 제목들 (계산됨)
  createdAt: Date; // 파일 생성 시간
  updatedAt: Date; // 파일 수정 시간
}

export interface Frontmatter {
  title?: string;
  tags?: string[];
  [key: string]: string | string[] | number | boolean | undefined; // 기타 커스텀 필드
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

// Voice Memo types

export interface VoiceMemoMeta {
  id: string; // 파일명에서 확장자 제외 (예: "2026-01-31-a1b2c3d4e5f6")
  filename: string; // 오디오 파일명 (예: "2026-01-31-a1b2c3d4e5f6.webm")
  folder: string; // 저장 폴더 (예: "default")
  status: "recorded" | "transcribed" | "summarized";
  duration: number; // 녹음 길이 (초)
  transcript: string | null;
  summary: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface PhraseSet {
  id: string;
  name: string;
  phrases: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PhraseSetStore {
  phraseSets: PhraseSet[];
  selectedId: string | null;
}

// Chat types

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string; // ISO 8601
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  messages: ChatMessage[];
}

export interface ChatSessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatSessionIndex {
  sessions: ChatSessionMeta[];
}

// Publish types (추후 구현)

export interface PublishConfig {
  enabled: boolean;
  deploymentUrl?: string;
  lastPublishedAt?: Date;
}
