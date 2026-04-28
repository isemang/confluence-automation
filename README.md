# 개발팀 일일점검 자동화 시스템

한국거래소 영업일 기준으로 매일 컨플루언스에 일일점검 페이지를 자동 생성하고 Slack 알림을 보내는 시스템입니다.

## 📋 기능

- **영업일 자동 판단**: 한국거래소 코스피 시장 영업일 기준으로 페이지 생성 여부 결정
- **컨플루언스 페이지 자동 생성**: "개발팀 홈" > "일일점검페이지" > "yyyy년" > "mm월" 구조로 페이지 생성
- **Slack 알림**: 페이지 생성 완료 시 및 매일 아침 8시 알림 전송
- **에러 알림**: 시스템 오류 발생 시 Slack으로 에러 알림
- **스케줄 자동화**: 매일 오전 7:30에 페이지 생성, 8:00에 알림 전송

## 🏗️ 시스템 구조

```
src/
├── index.js                    # 메인 애플리케이션 및 스케줄러
├── utils/
│   └── tradingDayChecker.js   # 한국거래소 영업일 확인 로직
└── services/
    ├── confluenceService.js   # 컨플루언스 API 연동
    └── slackService.js        # Slack 웹훅 알림
```

## 🚀 설치 및 설정

### 1. 프로젝트 설치

```bash
# 저장소 클론
git clone <repository-url>
cd confluence-daily-checker

# 의존성 설치
npm install
```

### 2. 환경변수 설정

`.env` 파일을 생성하고 다음 내용을 설정하세요:

```env
# Confluence 설정
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@company.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_PARENT_PAGE_ID=123456789

# Slack 설정
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
SLACK_CHANNEL=#dev-team

# 시간대 설정
TIMEZONE=Asia/Seoul
```

### 3. Confluence API 토큰 생성

1. Atlassian 계정 설정으로 이동: https://id.atlassian.com/manage-profile/security/api-tokens
2. "API 토큰 만들기" 클릭
3. 토큰 이름 입력 후 생성
4. 생성된 토큰을 `CONFLUENCE_API_TOKEN`에 설정

### 4. Confluence 상위 페이지 ID 확인

1. "개발팀 홈" 페이지로 이동
2. URL에서 페이지 ID 확인 (예: `/pages/123456789/`)
3. 해당 ID를 `CONFLUENCE_PARENT_PAGE_ID`에 설정

### 5. Slack 웹훅 URL 생성

1. Slack 앱 설정으로 이동: https://api.slack.com/apps
2. "Create New App" > "From scratch" 선택
3. "Incoming Webhooks" 활성화
4. 웹훅 URL 생성 후 `SLACK_WEBHOOK_URL`에 설정

## 🔧 사용법

### 기본 실행 (스케줄러 모드)

```bash
npm start
```

스케줄러가 시작되어 다음과 같이 동작합니다:
- 매일 07:30 - 일일점검 페이지 생성
- 매일 08:00 - Slack 아침 알림 전송

### 수동 실행

```bash
# 즉시 일일점검 페이지 생성 및 알림
npm run manual

# 또는
node src/index.js --manual
```

### 아침 알림만 전송

```bash
node src/index.js --morning
```

### 개발 모드 실행

```bash
npm run dev
```

## 📅 페이지 구조

생성되는 컨플루언스 페이지 구조:

```
개발팀 홈 (CONFLUENCE_PARENT_PAGE_ID)
└── 일일점검페이지
    └── 2026년
        └── 04월
            ├── 2026-04-01 개발팀 일일점검
            ├── 2026-04-02 개발팀 일일점검
            └── ...
```

## 📊 일일점검 페이지 템플릿

자동 생성되는 일일점검 페이지에는 다음 항목들이 포함됩니다:

- 🔍 시스템 상태 확인 (웹서버, API서버, DB, 캐시서버)
- 📊 모니터링 지표 (CPU, 메모리, 디스크, 응답시간)
- 🚀 배포 현황
- ⚠️ 이슈 및 장애 현황
- 🔒 보안 점검
- 📝 특이사항
- ✅ 점검 완료 체크리스트

## 🔄 배포

### PM2를 사용한 배포 (권장)

```bash
# PM2 설치
npm install -g pm2

# 애플리케이션 시작
pm2 start src/index.js --name "daily-check-automation"

# PM2 상태 확인
pm2 status

# 로그 확인
pm2 logs daily-check-automation

# 재시작
pm2 restart daily-check-automation

# 중지
pm2 stop daily-check-automation
```

### Docker를 사용한 배포

```bash
# Dockerfile 생성
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY .env ./

CMD ["node", "src/index.js"]
EOF

# 이미지 빌드
docker build -t daily-check-automation .

# 컨테이너 실행
docker run -d --name daily-check-automation \
  --restart unless-stopped \
  daily-check-automation
```

### Systemd 서비스 등록

```bash
# 서비스 파일 생성
sudo cat > /etc/systemd/system/daily-check-automation.service << 'EOF'
[Unit]
Description=Daily Check Automation
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/confluence-daily-checker
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 서비스 활성화
sudo systemctl enable daily-check-automation
sudo systemctl start daily-check-automation

# 서비스 상태 확인
sudo systemctl status daily-check-automation
```

## 🧪 테스트

### 설정 확인 테스트

```bash
# 현재 설정으로 수동 실행 테스트
node src/index.js --manual
```

### 영업일 로직 테스트

```javascript
const TradingDayChecker = require('./src/utils/tradingDayChecker');
const checker = new TradingDayChecker();

console.log('오늘은 영업일인가?', checker.isTodayTradingDay());
console.log('특정일 확인 (2026-04-28):', checker.isTradingDay('2026-04-28'));
```

## 🔧 유지보수

### 1. 공휴일 업데이트

매년 `src/utils/tradingDayChecker.js` 파일의 `holidays{YEAR}` 배열을 업데이트하세요.

### 2. 로그 모니터링

정기적으로 애플리케이션 로그를 확인하여 오류나 이상 동작을 점검하세요.

```bash
# PM2 사용시
pm2 logs daily-check-automation

# Docker 사용시
docker logs daily-check-automation

# Systemd 사용시
sudo journalctl -u daily-check-automation -f
```

### 3. 백업

중요한 설정 파일들을 정기적으로 백업하세요:
- `.env` 파일
- `src/utils/tradingDayChecker.js` (공휴일 데이터)

## 🚨 트러블슈팅

### 일반적인 문제들

1. **컨플루언스 연결 실패**
   - API 토큰 유효성 확인
   - 네트워크 연결 상태 확인
   - 권한 설정 확인

2. **Slack 알림 전송 실패**
   - 웹훅 URL 유효성 확인
   - 채널 존재 여부 확인

3. **페이지 생성 실패**
   - 상위 페이지 ID 확인
   - 컨플루언스 권한 확인

### 로그 레벨 설정

환경변수로 로그 레벨을 조정할 수 있습니다:

```env
LOG_LEVEL=debug  # debug, info, warn, error
```

## 📞 지원

문제가 발생하거나 개선사항이 있다면 개발팀에 문의하세요.

## 📄 라이선스

MIT License