# Vitriol Revamped - 기술 계획서

## 프로젝트 개요

AI 연동 옵시디언 스타일 메모 앱
- 마크다운 기반 에디터 (CodeMirror 6)
- AI 이어쓰기 (Gemini - 추후 구현)
- [[위키링크]] 및 포스 그래프
- RAG 기반 시맨틱 서치
- 챗봇 질의응답
- 블로그처럼 배포 가능

---

## 기술 스택

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **에디터**: CodeMirror 6
  - 마크다운 편집
  - 실시간 미리보기 (react-markdown)
  - [[위키링크]] 지원 (remark-wiki-link)
- **그래프**: react-force-graph-2d
- **UI 컴포넌트**: shadcn/ui

### Backend
- **API**: Next.js API Routes (서버리스)
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **파일 저장**: Firebase Storage (이미지 등)

### AI/ML
- **LLM**: Google Gemini API
  - AI 이어쓰기 (추후 구현)
  - Function Calling (문서 CRUD)
  - 챗봇 대화
- **임베딩**: Gemini Embedding API
- **벡터 DB**: (추후 결정 - Pinecone/Qdrant/Firestore Vector Extension)

### 배포
- **호스팅**: Vercel
- **도메인**: (추후 설정)

---

## 데이터 모델

### Document (Firestore)
```typescript
interface Document {
  id: string
  title: string
  content: string // 마크다운 텍스트
  links: string[] // 이 문서가 링크하는 다른 문서 ID들
  backlinks: string[] // 이 문서를 링크하는 문서 ID들
  createdAt: Timestamp
  updatedAt: Timestamp
  userId: string
  isPublic: boolean // 블로그 공개 여부
  tags: string[]
}
```

### Graph Edge (계산됨)
```typescript
interface GraphEdge {
  source: string // document ID
  target: string // linked document ID
}
```

### User Settings
```typescript
interface UserSettings {
  userId: string
  geminiApiKey?: string // 사용자 자신의 API 키
  allowPublicChat: boolean // 방문자 챗봇 사용 허용
  allowPublicSearch: boolean // 방문자 시맨틱 서치 허용
}
```

---

## 주요 기능 구현 계획

### 1단계: MVP (핵심 메모 앱)
- [x] Next.js 프로젝트 세팅
- [x] 마크다운 에디터 구현 (CodeMirror 6)
- [x] [[위키링크]] 렌더링 (remark-wiki-link)
- [ ] Firebase 연동
- [ ] 문서 CRUD
- [ ] [[위키링크]] 파싱 및 연결
- [ ] 그래프 뷰
- [ ] 기본 검색

### 2단계: AI 연동
- [ ] Gemini Function Calling 구현
  - `create_document(title, content)`
  - `update_document(id, edits: [{old, new}])`
  - `delete_document(id)`
  - `search_documents(query)`
- [ ] AI 챗봇 인터페이스
- [ ] 문서 컨텍스트 주입 (선택된 문서를 챗봇에게)

### 3단계: RAG & 시맨틱 서치
- [ ] 문서 임베딩 생성
- [ ] 벡터 DB 저장
- [ ] 시맨틱 서치 API
- [ ] RAG 파이프라인
  - 질문 → 임베딩 → 유사 문서 검색 → LLM에 컨텍스트 제공

### 4단계: 블로그 배포 기능
- [ ] 공개/비공개 설정
- [ ] 공개 문서 뷰어 (읽기 전용)
- [ ] 로컬 그래프 (현재 문서 주변만)
- [ ] 권한 관리 (어드민/방문자)
- [ ] SEO 최적화

---

## 핵심 기능 상세 설계

### [[위키링크]] 파싱

**마크다운 렌더링:**
```typescript
// MarkdownViewer에서 remark-wiki-link 사용
import remarkWikiLink from "remark-wiki-link";

<ReactMarkdown
  remarkPlugins={[
    [remarkWikiLink, {
      pageResolver: (name: string) => [name.replace(/ /g, "-").toLowerCase()],
      hrefTemplate: (permalink: string) => `/doc/${permalink}`,
      wikiLinkClassName: "wiki-link",
    }],
  ]}
>
  {content}
</ReactMarkdown>
```

**저장 시 처리:**
```typescript
function parseLinks(content: string): string[] {
  // 마크다운 텍스트에서 [[title]] 추출
  const regex = /\[\[([^\]]+)\]\]/g;
  const matches = [...content.matchAll(regex)];
  const titles = matches.map(m => m[1]);

  // Firestore에서 title로 문서 찾기
  // document ID 배열 반환
  return titles;
}

async function updateDocument(id, content) {
  const links = parseLinks(content)

  // 1. 문서 업데이트
  await updateDoc(docRef, { content, links })

  // 2. 역방향 링크 업데이트 (backlinks)
  for (const linkedId of links) {
    await updateDoc(linkedId, {
      backlinks: arrayUnion(id)
    })
  }
}
```

### 그래프 뷰

```typescript
// 모든 문서의 링크 관계를 그래프로 변환
function buildGraph(documents: Document[]) {
  const nodes = documents.map(doc => ({
    id: doc.id,
    label: doc.title,
    size: doc.backlinks.length // 백링크 많을수록 크게
  }))

  const edges = documents.flatMap(doc =>
    doc.links.map(targetId => ({
      source: doc.id,
      target: targetId
    }))
  )

  return { nodes, edges }
}
```

**로컬 그래프 (공개 페이지용):**
```typescript
function buildLocalGraph(docId: string, depth = 1) {
  // 현재 문서와 직접 연결된 것들만
  // depth 조절 가능
}
```

### Gemini Function Calling

```typescript
// app/api/chat/route.ts
const tools = [
  {
    name: "search_documents",
    description: "문서 검색",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "검색어" }
      }
    }
  },
  {
    name: "edit_document",
    description: "문서 수정 (diff 방식)",
    parameters: {
      type: "object",
      properties: {
        document_id: { type: "string" },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              search: { type: "string", description: "찾을 텍스트" },
              replace: { type: "string", description: "바꿀 텍스트" }
            }
          }
        }
      }
    }
  }
]

export async function POST(req: Request) {
  const { message } = await req.json()

  const response = await gemini.generateContent({
    contents: [{ role: 'user', parts: [{ text: message }] }],
    tools: tools
  })

  // Function call 처리
  if (response.functionCall) {
    const result = await executeTool(
      response.functionCall.name,
      response.functionCall.args
    )

    // 결과를 다시 LLM에게
    const finalResponse = await gemini.generateContent({
      contents: [...previousMessages, {
        role: 'function',
        parts: [{ functionResponse: result }]
      }]
    })

    return Response.json(finalResponse)
  }
}
```

### RAG 파이프라인

**1. 문서 저장 시 임베딩 생성**
```typescript
async function onDocumentCreate(doc: Document) {
  // 문서를 청크로 분할
  const chunks = splitIntoChunks(doc.contentText, 500)

  // 각 청크 임베딩
  for (const chunk of chunks) {
    const embedding = await gemini.embedContent(chunk)

    await vectorDB.insert({
      docId: doc.id,
      chunk: chunk,
      embedding: embedding,
      metadata: { title: doc.title }
    })
  }
}
```

**2. 시맨틱 서치**
```typescript
async function semanticSearch(query: string, topK = 5) {
  const queryEmbedding = await gemini.embedContent(query)

  const results = await vectorDB.search(queryEmbedding, topK)

  return results.map(r => ({
    docId: r.docId,
    chunk: r.chunk,
    similarity: r.score
  }))
}
```

**3. RAG 기반 답변**
```typescript
async function answerWithRAG(question: string) {
  // 1. 관련 문서 찾기
  const relevantChunks = await semanticSearch(question)

  // 2. 컨텍스트 구성
  const context = relevantChunks
    .map(c => c.chunk)
    .join('\n\n---\n\n')

  // 3. LLM에게 질문
  const prompt = `
다음 문서들을 참고해서 질문에 답변해주세요.

문서:
${context}

질문: ${question}
  `

  const response = await gemini.generateContent(prompt)
  return response.text
}
```

---

## 폴더 구조

```
vitriol-revamped/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/
│   │   ├── documents/
│   │   │   ├── [id]/
│   │   │   └── page.tsx
│   │   ├── graph/
│   │   └── search/
│   ├── (public)/
│   │   └── [username]/
│   │       └── [slug]/
│   ├── api/
│   │   ├── documents/
│   │   ├── chat/
│   │   ├── generate/ (AI 이어쓰기 - 추후 구현)
│   │   ├── search/
│   │   └── embeddings/
│   └── layout.tsx
├── components/
│   ├── editor/
│   │   ├── MarkdownEditor.tsx
│   │   └── MarkdownViewer.tsx
│   ├── graph/
│   │   └── ForceGraph.tsx
│   └── ui/ (shadcn)
├── lib/
│   ├── firebase.ts
│   ├── gemini.ts
│   ├── document-parser.ts
│   └── vector-db.ts
├── hooks/
│   └── useDocuments.ts
└── types/
    └── index.ts
```

---

## 환경 변수

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Gemini (서버 측 - 관리자용)
GEMINI_API_KEY=

# Vector DB (선택)
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=
```

---

## 다음 단계

1. ✅ 기술 스택 확정
2. ✅ Next.js 프로젝트 생성
3. ✅ 마크다운 에디터 구현
4. ⏳ Firebase 프로젝트 생성 및 연동
5. ⏳ 문서 CRUD API 구현
6. ⏳ 그래프 뷰 구현

---

## 참고 자료

- [CodeMirror 6](https://codemirror.net/)
- [react-markdown](https://github.com/remarkjs/react-markdown)
- [remark-wiki-link](https://github.com/landakram/remark-wiki-link)
- [Next.js 14 문서](https://nextjs.org/docs)
- [Firebase 문서](https://firebase.google.com/docs)
- [Gemini API](https://ai.google.dev/docs)
- [react-force-graph](https://github.com/vasturiano/react-force-graph)
