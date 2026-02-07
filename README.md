# Synapse

**Synapse**는 로컬 마크다운 파일 기반의 개인 지식 관리 시스템입니다. 위키링크와 태그를 사용하여 생각을 연결하고, 시각적인 그래프 뷰로 아이디어 간의 관계를 탐색할 수 있습니다.

## 주요 기능

- 📝 **마크다운 기반 노트 작성**: 익숙한 마크다운 문법으로 빠르게 작성
- 🔗 **위키링크**: `[[문서명]]` 형식으로 문서 간 연결
- 🏷️ **태그 시스템**: 프론트매터를 통한 체계적인 분류
- 🕸️ **인터랙티브 그래프 뷰**: D3.js 기반의 시각적 지식 네트워크
- 🔍 **실시간 검색**: 문서 제목 및 내용 검색
- 🖼️ **이미지 지원**: 드래그 앤 드롭으로 간편한 이미지 첨부
- 🎙️ **음성 메모**: 녹음/업로드 → STT 녹취록 → AI 요약, 화자 분리
- 🤖 **Neuro AI 챗봇**: Function Calling으로 문서 CRUD 가능한 AI 어시스턴트
- 💾 **자동 저장**: 드래프트 자동 저장 및 복구, 페이지 이탈 경고
- 💻 **데스크톱 앱**: Electron 기반 크로스 플랫폼 지원 (macOS, Windows, Linux)
- 🌐 **Publish 기능**: Vercel을 통한 읽기 전용 사이트 배포

## 설치 방법

### 데스크톱 앱 (권장)

[Releases](https://github.com/thewronghand/synapse/releases) 페이지에서 운영체제에 맞는 설치 파일을 다운로드하세요:

- **macOS**: `Synapse-{version}-arm64.dmg` (Apple Silicon) 또는 `Synapse-{version}.dmg` (Intel)

노트는 자동으로 `~/Documents/Synapse/notes/`에 저장됩니다.

#### macOS 보안 경고 해결

macOS에서 "손상되어 열 수 없습니다" 또는 "확인할 수 없습니다" 경고가 나타나면, 터미널에서 다음 명령어를 실행하세요:

```bash
xattr -cr /Applications/Synapse.app
```

그 후 앱을 다시 실행하면 정상적으로 열립니다.

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

### 그래프 뷰

- 메뉴에서 "Graph" 선택
- 노드 클릭으로 해당 문서 이동
- 드래그로 그래프 이동, 스크롤로 확대/축소
- 노드 크기는 연결된 문서 수를 반영

## 기술 스택

### 프론트엔드
- **Next.js 16** - React 프레임워크
- **React 19** - UI 라이브러리
- **TypeScript** - 타입 안전성
- **Tailwind CSS 4** - 스타일링
- **CodeMirror 6** - 마크다운 에디터
- **D3.js 7** - 그래프 시각화

### AI
- **Mastra** - AI Agent 프레임워크
- **Google Vertex AI / Gemini** - AI 모델
- **Vercel AI SDK** - 채팅 스트리밍

### 데스크톱
- **Electron 39** - 크로스 플랫폼 데스크톱 앱

### 데이터
- **로컬 파일 시스템** - 마크다운 파일 저장
- **LibSQL** - 채팅 히스토리 및 워킹 메모리
- **gray-matter** - 프론트매터 파싱
- **remark** - 마크다운 처리

## 개발

### 프로젝트 구조

```
synapse/
├── app/                  # Next.js App Router
│   ├── api/             # API 라우트
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
│   └── voice-memo/      # 음성 메모
├── lib/                 # 유틸리티 함수
│   └── mastra/          # AI Agent (Tools, Memory)
├── electron/            # Electron 메인 프로세스
├── notes/               # 기본 노트 (개발용)
├── public/              # 정적 파일
└── types/               # TypeScript 타입 정의
```

### 빌드

```bash
# 웹 빌드
npm run build

# Electron 앱 빌드
npm run electron:build
```

빌드된 앱은 `dist/` 폴더에 생성됩니다.

### 릴리즈 (Maintainers)

> 일반 사용자는 [Releases](https://github.com/thewronghand/synapse/releases) 페이지에서 빌드된 설치 파일을 다운로드하세요.

**프로젝트 관리자용:** 새 버전을 릴리즈하려면 태그를 생성하고 푸시하세요:

```bash
# 태그 생성
git tag v0.2.0

# 태그 푸시
git push origin v0.2.0
```

GitHub Actions가 자동으로 멀티 플랫폼 빌드를 실행하고 Release를 생성합니다.

## 라이선스

MIT License
