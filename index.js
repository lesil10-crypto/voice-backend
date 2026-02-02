// 환경변수 로드 (제일 먼저!)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// 환경변수
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('🔍 환경변수 확인:');
console.log('  - OPENAI_API_KEY:', OPENAI_API_KEY ? '✓ 설정됨' : '❌ 미설정');
console.log('  - ANTHROPIC_API_KEY:', ANTHROPIC_API_KEY ? '✓ 설정됨' : '⚠️ 미설정');

// CORS 설정
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer 설정
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/mp4',
      'audio/m4a',
      'audio/ogg',
      'audio/x-m4a'
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|webm|mp4|m4a|ogg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`지원되지 않는 파일 형식입니다. (${file.mimetype})`));
    }
  }
});

// uploads 폴더 생성
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// ✅ 루트 경로 핸들러 (중요!)
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'AI 음성 받아쓰기 백엔드',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      transcribe: '/api/transcribe',
      transcribeAudio: '/api/transcribe-audio'
    },
    whisper_available: !!OPENAI_API_KEY,
    claude_available: !!ANTHROPIC_API_KEY
  });
});

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Server is running'
  });
});

// 텍스트 전사 (Claude API)
app.post('/api/transcribe', async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript || transcript.trim().length === 0) {
      return res.status(400).json({ error: '전사할 내용이 없습니다.' });
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' });
    }

    console.log('📤 Claude API 요청 중...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `다음은 음성 인식으로 받아쓴 텍스트입니다. 이를 정리하고 요약해주세요.

받아쓴 내용:
${transcript}

다음 형식으로 응답해주세요:
1. 전체 내용을 의미 단위로 나누어 단락을 만들어주세요
2. 각 단락마다 한 줄 요약을 제공해주세요
3. 맞춤법과 문장을 자연스럽게 교정해주세요

응답은 다음 JSON 형식으로 해주세요:
{
  "paragraphs": [
    {
      "summary": "단락 요약",
      "content": "교정된 내용"
    }
  ]
}`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API 오류: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.content.find(block => block.type === 'text')?.text;
    
    const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      res.json(result);
    } else {
      res.json({
        paragraphs: [{
          summary: '전사 결과',
          content: assistantMessage
        }]
      });
    }

  } catch (error) {
    console.error('❌ 전사 오류:', error);
    res.status(500).json({ 
      error: error.message || '전사 중 오류가 발생했습니다.'
    });
  }
});

// Whisper API 파일 전사
app.post('/api/transcribe-audio', upload.single('audio'), async (req, res) => {
  let uploadedFilePath = null;

  try {
    console.log('🎤 파일 전사 요청 받음');

    if (!req.file) {
      return res.status(400).json({ error: '오디오 파일이 없습니다.' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OPENAI_API_KEY가 설정되지 않았습니다.'
      });
    }

    uploadedFilePath = req.file.path;
    console.log('📁 업로드:', req.file.originalname, `(${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);

    // Whisper API 전사
    console.log('🎤 Whisper API 전사 시작...');
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(uploadedFilePath), {
      filename: req.file.originalname,
      contentType: req.file.mimetype || 'audio/mpeg'
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'ko');
    formData.append('response_format', 'json');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API 오류:', errorText);
      
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }
      
      throw new Error(`Whisper API 오류 (${whisperResponse.status})`);
    }

    const whisperData = await whisperResponse.json();
    const rawTranscript = whisperData.text;
    
    console.log('✅ Whisper 전사 완료');

    // 파일 삭제
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
      uploadedFilePath = null;
    }

    if (!rawTranscript || rawTranscript.trim().length === 0) {
      return res.json({
        raw_transcript: '',
        paragraphs: [{
          summary: '전사 결과 없음',
          content: '음성에서 텍스트를 인식하지 못했습니다.'
        }]
      });
    }

    // Claude API로 정리
    if (ANTHROPIC_API_KEY) {
      console.log('📝 Claude API로 정리 중...');

      try {
        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{
              role: 'user',
              content: `다음은 Whisper AI로 전사한 음성 내용입니다. 이를 정리하고 요약해주세요.

전사된 내용:
${rawTranscript}

다음 형식으로 응답해주세요:
1. 전체 내용을 의미 단위로 나누어 단락을 만들어주세요
2. 각 단락마다 한 줄 요약을 제공해주세요
3. 맞춤법과 문장을 자연스럽게 교정해주세요

응답은 다음 JSON 형식으로 해주세요:
{
  "paragraphs": [
    {
      "summary": "단락 요약",
      "content": "교정된 내용"
    }
  ]
}`
            }]
          })
        });

        if (claudeResponse.ok) {
          const claudeData = await claudeResponse.json();
          const assistantMessage = claudeData.content.find(block => block.type === 'text')?.text;

          if (assistantMessage) {
            const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);
              return res.json({
                raw_transcript: rawTranscript,
                ...result
              });
            }
          }
        }
      } catch (claudeError) {
        console.error('⚠️ Claude 처리 오류:', claudeError.message);
      }
    }

    // Whisper 결과만 반환
    return res.json({
      raw_transcript: rawTranscript,
      paragraphs: [{
        summary: 'Whisper AI 전사 결과',
        content: rawTranscript
      }]
    });

  } catch (error) {
    console.error('❌ 파일 전사 오류:', error);
    
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (e) {}
    }

    res.status(500).json({ 
      error: error.message || '파일 전사 중 오류가 발생했습니다.'
    });
  }
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('🔥 서버 에러:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '파일 크기가 25MB를 초과합니다.' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  res.status(500).json({ 
    error: err.message || '서버 오류가 발생했습니다.'
  });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🎤 AI 음성 받아쓰기 백엔드 서버 시작    ║
╚═══════════════════════════════════════════╝

✅ 서버 실행: http://0.0.0.0:${PORT}
✅ Whisper API: ${OPENAI_API_KEY ? '활성화 ✓' : '❌ 비활성화'}
✅ Claude API: ${ANTHROPIC_API_KEY ? '활성화 ✓' : '⚠️ 선택사항'}

📡 엔드포인트:
  - GET  /                        : 상태 확인
  - GET  /health                  : 헬스체크
  - POST /api/transcribe          : 텍스트 전사 (Claude)
  - POST /api/transcribe-audio    : 파일 전사 (Whisper + Claude)

⚙️ 환경변수:
  - OPENAI_API_KEY: ${OPENAI_API_KEY ? '✓ 설정됨' : '❌ 미설정'}
  - ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY ? '✓ 설정됨' : '⚠️ 미설정'}

🌍 CORS: 모든 origin 허용 (*)
`);
});