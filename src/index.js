require('dotenv').config();
const cron = require('node-cron');
const moment = require('moment-timezone');

const TradingDayChecker = require('./utils/tradingDayChecker');
const ConfluenceService = require('./services/confluenceService');
const SlackService = require('./services/slackService');

class DailyCheckAutomation {
    constructor() {
        this.tradingDayChecker = new TradingDayChecker();
        this.confluenceService = new ConfluenceService();
        this.slackService = new SlackService();
        this.timezone = process.env.TIMEZONE || 'Asia/Seoul';

        console.log('=== 개발팀 일일점검 자동화 시스템 시작 ===');
        console.log(`시간대: ${this.timezone}`);
        console.log(`현재 시간: ${moment().tz(this.timezone).format('YYYY-MM-DD HH:mm:ss')}`);
    }

    /**
     * 일일점검 페이지 생성 및 알림 처리
     */
    async processDaily() {
        const today = this.tradingDayChecker.getTodayInKST();
        const todayStr = today.format('YYYY-MM-DD');

        console.log(`\n=== ${todayStr} 일일점검 처리 시작 ===`);

        try {
            // 1. 영업일 확인
            if (!this.tradingDayChecker.isTodayTradingDay()) {
                console.log(`${todayStr}는 영업일이 아닙니다. 페이지 생성을 건너뜁니다.`);
                return {
                    success: true,
                    skipped: true,
                    reason: '비영업일'
                };
            }

            console.log(`${todayStr}는 영업일입니다. 일일점검 페이지를 생성합니다.`);

            // 2. 컨플루언스 페이지 생성
            console.log('컨플루언스 페이지 생성 중...');
            const pageResult = await this.confluenceService.createDailyCheckPage(today);

            // 3. Slack 알림 전송
            if (this.slackService.isConfigured()) {
                console.log('Slack 알림 전송 중...');

                if (pageResult.isNew) {
                    // 새로 생성된 경우 생성 완료 알림
                    await this.slackService.notifyDailyCheckPageCreated(pageResult, today);
                } else {
                    // 이미 존재하는 경우에도 아침 알림은 전송
                    console.log('페이지가 이미 존재하므로 아침 알림만 전송합니다.');
                }

                console.log('Slack 알림 전송 완료');
            } else {
                console.warn('Slack Webhook URL이 설정되지 않았습니다. 알림을 건너뜁니다.');
            }

            console.log(`=== ${todayStr} 일일점검 처리 완료 ===\n`);

            return {
                success: true,
                pageCreated: pageResult.isNew,
                pageUrl: pageResult.url,
                pageId: pageResult.page.id
            };

        } catch (error) {
            console.error(`일일점검 처리 중 오류 발생:`, error);

            // 에러 발생 시 Slack 알림
            if (this.slackService.isConfigured()) {
                try {
                    await this.slackService.notifyError(error, `일일점검 처리 (${todayStr})`);
                } catch (slackError) {
                    console.error('Slack 에러 알림 전송 실패:', slackError);
                }
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 아침 8시 알림 전송
     */
    async sendMorningNotification() {
        const today = this.tradingDayChecker.getTodayInKST();
        const todayStr = today.format('YYYY-MM-DD');

        console.log(`\n=== ${todayStr} 아침 알림 처리 시작 ===`);

        try {
            // 1. 영업일 확인
            if (!this.tradingDayChecker.isTodayTradingDay()) {
                console.log(`${todayStr}는 영업일이 아닙니다. 아침 알림을 건너뜁니다.`);
                return {
                    success: true,
                    skipped: true,
                    reason: '비영업일'
                };
            }

            // 2. 오늘 일일점검 페이지가 존재하는지 확인
            console.log('일일점검 페이지 확인 중...');
            const pageResult = await this.confluenceService.createDailyCheckPage(today);

            // 3. 아침 알림 전송
            if (this.slackService.isConfigured()) {
                console.log('아침 알림 전송 중...');
                await this.slackService.sendDailyMorningNotification(pageResult, today);
                console.log('아침 알림 전송 완료');
            } else {
                console.warn('Slack Webhook URL이 설정되지 않았습니다. 알림을 건너뜁니다.');
            }

            console.log(`=== ${todayStr} 아침 알림 처리 완료 ===\n`);

            return {
                success: true,
                notificationSent: true,
                pageUrl: pageResult.url
            };

        } catch (error) {
            console.error(`아침 알림 처리 중 오류 발생:`, error);

            // 에러 발생 시 Slack 알림
            if (this.slackService.isConfigured()) {
                try {
                    await this.slackService.notifyError(error, `아침 알림 처리 (${todayStr})`);
                } catch (slackError) {
                    console.error('Slack 에러 알림 전송 실패:', slackError);
                }
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 수동 실행 (테스트용)
     */
    async runManually() {
        console.log('수동 실행 모드');

        const result = await this.processDaily();

        if (result.success) {
            console.log('수동 실행 완료:', result);
        } else {
            console.error('수동 실행 실패:', result.error);
        }

        return result;
    }

    /**
     * 크론 스케줄러 시작
     */
    startScheduler() {
        console.log('스케줄러 시작...');

        // 매일 아침 8시에 아침 알림 전송 (한국 시간 기준)
        const morningSchedule = '0 8 * * *';
        console.log(`아침 알림 스케줄 등록: ${morningSchedule} (매일 08:00 KST)`);

        cron.schedule(morningSchedule, async () => {
            console.log(`\n[${moment().tz(this.timezone).format('YYYY-MM-DD HH:mm:ss')}] 아침 알림 스케줄 실행`);
            await this.sendMorningNotification();
        }, {
            scheduled: true,
            timezone: this.timezone
        });

        // 매일 아침 7시 30분에 일일점검 페이지 생성 (아침 알림보다 먼저)
        const pageCreateSchedule = '30 7 * * *';
        console.log(`페이지 생성 스케줄 등록: ${pageCreateSchedule} (매일 07:30 KST)`);

        cron.schedule(pageCreateSchedule, async () => {
            console.log(`\n[${moment().tz(this.timezone).format('YYYY-MM-DD HH:mm:ss')}] 페이지 생성 스케줄 실행`);
            await this.processDaily();
        }, {
            scheduled: true,
            timezone: this.timezone
        });

        console.log('스케줄러가 시작되었습니다.');
        console.log('프로그램이 실행 중입니다. 종료하려면 Ctrl+C를 누르세요.');

        // 프로세스가 종료되지 않도록 유지
        setInterval(() => {
            // 매시간마다 상태 출력 (선택사항)
            // console.log(`[${moment().tz(this.timezone).format('YYYY-MM-DD HH:mm:ss')}] 시스템 정상 동작 중...`);
        }, 3600000); // 1시간마다
    }

    /**
     * 설정 검증
     */
    validateConfiguration() {
        const errors = [];

        if (!process.env.CONFLUENCE_BASE_URL) {
            errors.push('CONFLUENCE_BASE_URL이 설정되지 않았습니다.');
        }

        if (!process.env.CONFLUENCE_USERNAME) {
            errors.push('CONFLUENCE_USERNAME이 설정되지 않았습니다.');
        }

        if (!process.env.CONFLUENCE_API_TOKEN) {
            errors.push('CONFLUENCE_API_TOKEN이 설정되지 않았습니다.');
        }

        if (!process.env.CONFLUENCE_PARENT_PAGE_ID) {
            errors.push('CONFLUENCE_PARENT_PAGE_ID가 설정되지 않았습니다.');
        }

        if (!this.slackService.isConfigured()) {
            console.warn('경고: SLACK_WEBHOOK_URL이 설정되지 않았습니다. Slack 알림이 전송되지 않습니다.');
        }

        if (errors.length > 0) {
            console.error('설정 오류:');
            errors.forEach(error => console.error(`- ${error}`));
            process.exit(1);
        }

        console.log('✅ 설정 검증 완료');
    }
}

// 메인 실행
async function main() {
    const automation = new DailyCheckAutomation();

    // 설정 검증
    automation.validateConfiguration();

    // 명령행 인자 처리
    const args = process.argv.slice(2);

    if (args.includes('--manual') || args.includes('-m')) {
        // 수동 실행 모드
        const result = await automation.runManually();
        process.exit(result.success ? 0 : 1);
    } else if (args.includes('--morning') || args.includes('-a')) {
        // 아침 알림만 실행
        const result = await automation.sendMorningNotification();
        process.exit(result.success ? 0 : 1);
    } else {
        // 스케줄러 모드 (기본)
        automation.startScheduler();
    }
}

// 에러 핸들링
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// 프로그램 시작
if (require.main === module) {
    main().catch((error) => {
        console.error('프로그램 실행 중 오류 발생:', error);
        process.exit(1);
    });
}

module.exports = DailyCheckAutomation;