# Synapse

**Synapse**는 로컬 마크다운 파일 기반의 개인 지식 관리 시스템입니다. 위키링크와 태그를 사용하여 생각을 연결하고, 시각적인 그래프 뷰로 아이디어 간의 관계를 탐색할 수 있습니다. AI 챗봇 Neuro가 문서 관리와 검색을 도와줍니다.

## 주요 기능

### 노트 관리
- 📝 **마크다운 기반 노트 작성**: 익숙한 마크다운 문법으로 빠르게 작성
- 🔗 **위키링크**: `[[문서명]]` 형식으로 문서 간 연결
- 🏷️ **태그 시스템**: 프론트매터를 통한 체계적인 분류
- 🕸️ **인터랙티브 그래프 뷰**: D3.js 기반의 시각적 지식 네트워크
- 🖼️ **이미지 지원**: 드래그 앤 드롭으로 간편한 이미지 첨부
- 💾 **자동 저장**: 드래프트 자동 저장 및 복구, 페이지 이탈 경고

### 검색
- 🔍 **제목 검색**: 자동완성 기반 빠른 문서 탐색
- 📄 **내용 검색**: 문서 내용에서 키워드 검색
- 🧠 **시맨틱 서치**: 벡터 임베딩 기반 의미 검색 (유사도 수준 선택 가능)

### AI (Neuro)
- 🤖 **Neuro AI 챗봇**: Gemini 기반 AI 어시스턴트
- 🔧 **Function Calling**: 문서 CRUD (생성, 읽기, 수정, 삭제, 이동)
- 📚 **벡터 RAG**: 문서 임베딩 기반 컨텍스트 인식 답변
- 🕸️ **Graph RAG**: 위키링크 관계를 활용한 연관 문서 검색
- 🌐 **Google Search Grounding**: 실시간 웹 검색 연동 + 출처 표시
- 🧠 **Semantic Recall**: 과거 대화에서 의미적으로 관련된 내용 검색
- 💭 **Working Memory**: 세션 간 지속되는 사용자 프로필
- 📋 **문서 컨텍스트**: 현재 보고 있는 문서/선택 텍스트를 Neuro에게 전달
- ✨ **텍스트 인용**: 드래그로 선택 → "뉴로에게 보내기" 팝오버

### 음성 메모
- 🎙️ **녹음/업로드**: 최대 60분 녹음, 자동 정지
- 📝 **STT 녹취록**: Google Cloud Speech-to-Text V2 (Chirp 3) 기반 자동 전사
- 👥 **화자 분리**: 여러 화자 자동 구분
- 📋 **AI 요약**: 녹취록을 구조화된 회의록으로 변환

### 배포 & 앱
- 💻 **데스크톱 앱**: Electron 기반 macOS 지원
- 🌐 **Publish**: Vercel을 통한 읽기 전용 사이트 배포
- 💬 **퍼블리시 챗봇**: 배포된 사이트에서 방문자가 문서에 대해 질문 가능
- 🎨 **폰트 시스템**: Spoqa Han Sans Neo 기본, IBM Plex / Wanted Sans 다운로드 적용

## 설치 방법

### 데스크톱 앱 (권장)

[Releases](https://github.com/thewronghand/synapse/releases) 페이지에서 설치 파일을 다운로드하세요:

- **macOS**: `Synapse-{version}-arm64.dmg` (Apple Silicon) 또는 `Synapse-{version}.dmg` (Intel)

노트는 자동으로 `~/Documents/Synapse/notes/`에 저장됩니다.

#### macOS 보안 경고 해결

macOS에서 "손상되어 열 수 없습니다" 또는 "확인할 수 없습니다" 경고가 나타나면:

```bash
xattr -cr /Applications/Synapse.app
```

### 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/thewronghand/synapse.git
cd synapse

# 의존성 설치
npm install

# 개발 서버 실행 (웹)
npm run dev

# Electron 개발 모드 실행 (데스크톱)
npm run electron:dev
```

### AI 기능 사용

AI 기능(Neuro 챗봇, 음성 메모 STT, 시맨틱 서치)을 사용하려면 Google Cloud Platform 서비스 어카운트가 필요합니다:

1. GCP 콘솔에서 서비스 어카운트 생성
2. Vertex AI, Speech-to-Text API 활성화
3. 앱 설정 > Neuro AI 탭에서 서비스 어카운트 JSON 업로드

## 사용 방법

### 노트 작성

1. **새 노트 만들기**: 홈 화면에서 "+ 새 노트" 버튼 클릭
2. **위키링크 만들기**: `[[링크할 문서명]]` 입력
3. **태그 추가**: 프론트매터에 `tags: [태그1, 태그2]` 추가
4. **이미지 첨부**: 에디터에 이미지 파일 드래그 앤 드롭

### 프론트매터 예시

```markdown
---
title: 문서 제목
tags: [개발, Next.js, 메모]
---

# 문서 내용 시작
```

### Neuro AI 챗봇

- 우하단 채팅 버튼으로 Neuro와 대화
- 문서 CRUD, 검색, 웹 검색 등 다양한 요청 가능
- 문서를 보면서 텍스트를 드래그하면 "뉴로에게 보내기" 팝오버 표시
- 현재 보고 있는 문서를 자동으로 컨텍스트로 전달

### 그래프 뷰

- 메뉴에서 "Graph" 선택
- 노드 클릭으로 해당 문서 이동
- 드래그로 그래프 이동, 스크롤로 확대/축소
- 노드 크기는 연결된 문서 수를 반영

## 기술 스택

### 프론트엔드
- **Next.js 16** + **React 19** + **TypeScript**
- **Tailwind CSS 4** - 스타일링
- **CodeMirror 6** - 마크다운 에디터
- **D3.js 7** - 그래프 시각화
- **Motion** (Framer Motion) - 애니메이션

### AI
- **Mastra** - AI Agent 프레임워크 (Tools, Memory, RAG, Graph RAG)
- **Google Vertex AI / Gemini** - LLM + 임베딩 모델
- **Vercel AI SDK** - 채팅 스트리밍
- **LibSQL** - 벡터 DB (임베딩 저장/검색) + 채팅 히스토리

### 데스크톱
- **Electron 41** - macOS 데스크톱 앱

### 데이터
- **로컬 파일 시스템** - 마크다운 파일 저장
- **gray-matter** - 프론트매터 파싱
- **remark / rehype** - 마크다운 처리

## 개발

### 프로젝트 구조

```
synapse/
├── app/                  # Next.js App Router
│   ├── api/             # API 라우트
│   │   ├── ai/          # AI (STT, 요약)
│   │   ├── chat/        # 챗봇 API
│   │   ├── documents/   # 문서 CRUD
│   │   ├── search/      # 검색 (키워드 + 시맨틱)
│   │   ├── settings/    # 설정 API
│   │   └── voice-memos/ # 음성 메모
│   ├── chat/            # AI 챗봇 전체 페이지
│   ├── documents/       # 문서 목록 페이지
│   ├── editor/          # 에디터 페이지
│   ├── note/            # 노트 상세 페이지
│   ├── settings/        # 설정 페이지
│   └── voice-memos/     # 음성 메모 페이지
├── components/          # React 컴포넌트
│   ├── chat/            # AI 챗봇 (Neuro)
│   ├── editor/          # 에디터 관련
│   ├── graph/           # 그래프 시각화
│   ├── settings/        # 설정 UI
│   ├── ui/              # 공통 UI
│   └── voice-memo/      # 음성 메모
├── lib/                 # 유틸리티 함수
│   └── mastra/          # AI Agent
│       ├── agents/      # Neuro Agent
│       ├── tools/       # Function Calling Tools
│       ├── embedding.ts # 벡터 임베딩
│       ├── memory.ts    # Working Memory
│       └── vector-store.ts # 벡터 DB
├── electron/            # Electron 메인 프로세스
├── scripts/             # 빌드 스크립트
├── public/              # 정적 파일
└── types/               # TypeScript 타입 정의
```

### 빌드

```bash
# 웹 빌드
npm run build

# 퍼블리시 모드 빌드 (Vercel 배포 시뮬레이션)
npm run build:publish

# Electron 앱 빌드
npm run electron:build
```

빌드된 앱은 `dist/` 폴더에 생성됩니다.

### 릴리즈 (Maintainers)

> 일반 사용자는 [Releases](https://github.com/thewronghand/synapse/releases) 페이지에서 빌드된 설치 파일을 다운로드하세요.

**프로젝트 관리자용:**

```bash
# dev에서 빌드 3종 검증
npm run build
npm run build:publish
npm run electron:build

# main으로 머지 후 태그 생성
git tag -a v1.3.0 -m "v1.3.0: 릴리즈 설명"
git push origin v1.3.0
```

GitHub Actions가 자동으로 macOS 빌드를 실행하고 Release를 생성합니다.

## 라이선스

MIT License
