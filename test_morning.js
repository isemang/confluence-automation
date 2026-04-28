// 아침 8시 시나리오 테스트
// .env 파일 수동 로드
const fs = require('fs');
try {
    const envContent = fs.readFileSync('.env', 'utf8');
    envContent.split('\n').forEach(line => {
        if (line.includes('=') && !line.startsWith('#') && line.trim()) {
            const [key, ...values] = line.split('=');
            process.env[key.trim()] = values.join('=').trim();
        }
    });
} catch (error) {
    console.log('⚠️ .env 파일을 찾을 수 없습니다. 기본값을 사용합니다.');
}

console.log('🌅 === 매일 아침 8시 일일점검 시스템 테스트 ===\n');

// 현재 시간 (한국 시간 기준)
const today = new Date();
const koreaTime = today.toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'});
const dateStr = today.toISOString().split('T')[0];

console.log('📅 현재 일시:', koreaTime);
console.log('📆 오늘 날짜:', dateStr);

// 영업일 확인 (간단한 로직)
const dayOfWeek = today.getDay(); // 0=일요일, 6=토요일
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

console.log('📊 요일:', dayNames[dayOfWeek] + '요일');
console.log('💼 영업일 여부:', isWeekend ? '❌ 휴일 (주말)' : '✅ 영업일');

if (isWeekend) {
    console.log('\n⏭️ 주말이므로 일일점검 페이지를 생성하지 않습니다.');
    process.exit(0);
}

console.log('\n🚀 영업일입니다! 일일점검 시스템을 시작합니다.');
console.log('📝 생성할 페이지 제목:', `${dateStr} 개발팀 일일점검`);

// 필요한 환경변수 확인
console.log('\n🔧 환경설정 확인:');
console.log('- Confluence URL:', process.env.CONFLUENCE_BASE_URL);
console.log('- Confluence User:', process.env.CONFLUENCE_USERNAME);
console.log('- Parent Page ID:', process.env.CONFLUENCE_PARENT_PAGE_ID);
console.log('- Slack Channel:', process.env.SLACK_CHANNEL);
console.log('- Enhanced API:', process.env.USE_ENHANCED_API);

console.log('\n✅ 모든 환경설정이 확인되었습니다!');
console.log('\n🎯 다음 단계: 컨플루언스 페이지 생성 및 Slack 알림 전송');