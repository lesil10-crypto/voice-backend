// API 설정
const API_CONFIG = {
    // 개발 환경: localhost
    development: 'http://localhost:3000',
    
    // 프로덕션 환경: Render 배포된 백엔드 URL
    // ⚠️ 아래 URL을 실제 Render 백엔드 URL로 변경하세요!
    production: 'https://voice-transcription-backend.onrender.com'
};

// 현재 환경 감지
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// API 베이스 URL
const API_BASE_URL = isDevelopment ? API_CONFIG.development : API_CONFIG.production;

console.log('🌐 API URL:', API_BASE_URL);
console.log('🔧 환경:', isDevelopment ? 'Development' : 'Production');
