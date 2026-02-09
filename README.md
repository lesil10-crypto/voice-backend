# 음성 전사 프론트엔드

실시간 음성 전사 웹 인터페이스 (GitHub Pages 배포용)

## 배포: GitHub Pages

### 1. config.js 수정

먼저 백엔드를 Render에 배포하고 URL을 받으세요.

`config.js` 파일을 열고 백엔드 URL을 수정:

```javascript
const API_CONFIG = {
    development: 'http://localhost:3000',
    production: 'https://voice-transcription-backend.onrender.com' // ← 실제 Render URL로 변경
};
```

### 2. GitHub 저장소 생성

```bash
cd frontend
git init
git add .
git commit -m "Initial commit: Frontend"
git remote add origin https://github.com/YOUR_USERNAME/voice-transcription-app.git
git branch -M main
git push -u origin main
```

### 3. GitHub Pages 활성화

1. GitHub 저장소로 이동: `https://github.com/YOUR_USERNAME/voice-transcription-app`
2. **Settings** 탭 클릭
3. 좌측 메뉴에서 **Pages** 클릭
4. **Source** 섹션에서:
   - Branch: `main` 선택
   - Folder: `/ (root)` 선택
5. **Save** 클릭

### 4. 배포 확인 (1-2분 소요)

배포가 완료되면 다음 URL로 접속 가능:
```
https://YOUR_USERNAME.github.io/voice-transcription-app/
```

## 파일 구조

```
frontend/
├── index.html    # 메인 페이지
├── config.js     # API 설정 (백엔드 URL)
└── README.md     # 이 파일
```

## 로컬 테스트

간단한 HTTP 서버로 테스트:

```bash
# Python 3
python -m http.server 8000

# Node.js (http-server 설치 필요)
npx http-server -p 8000
```

브라우저에서 `http://localhost:8000` 접속

⚠️ 로컬 테스트 시 백엔드도 함께 실행되어야 합니다.

## 업데이트 방법

코드 수정 후:

```bash
git add .
git commit -m "Update: 기능 개선"
git push origin main
```

GitHub Pages가 자동으로 재배포합니다 (1-2분 소요).
