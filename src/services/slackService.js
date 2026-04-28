const axios = require('axios');
const moment = require('moment-timezone');

class SlackService {
    constructor() {
        this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
        this.channel = process.env.SLACK_CHANNEL || '#dev-team';
        this.timezone = process.env.TIMEZONE || 'Asia/Seoul';
    }

    /**
     * 기본 Slack 메시지 전송
     */
    async sendMessage(message, options = {}) {
        try {
            const payload = {
                channel: options.channel || this.channel,
                text: message,
                username: options.username || '일일점검봇',
                icon_emoji: options.icon || ':clipboard:',
                ...options
            };

            const response = await axios.post(this.webhookUrl, payload);

            if (response.status === 200) {
                console.log('Slack 메시지 전송 성공');
                return true;
            } else {
                console.error('Slack 메시지 전송 실패:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Slack 메시지 전송 에러:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 일일점검 페이지 생성 완료 알림
     */
    async notifyDailyCheckPageCreated(pageInfo, date) {
        try {
            const dateStr = date.format('YYYY-MM-DD');
            const dayOfWeek = this.getKoreanDayOfWeek(date.day());

            const message = {
                channel: this.channel,
                username: '일일점검봇',
                icon_emoji: ':clipboard:',
                attachments: [
                    {
                        color: '#36a64f',
                        title: `📋 ${dateStr} 개발팀 일일점검 페이지가 생성되었습니다`,
                        title_link: pageInfo.url,
                        fields: [
                            {
                                title: '날짜',
                                value: `${dateStr} (${dayOfWeek})`,
                                short: true
                            },
                            {
                                title: '페이지 상태',
                                value: pageInfo.isNew ? '✨ 새로 생성됨' : '📄 이미 존재함',
                                short: true
                            },
                            {
                                title: '페이지 링크',
                                value: `<${pageInfo.url}|일일점검 페이지 바로가기>`,
                                short: false
                            }
                        ],
                        footer: '개발팀 일일점검 자동화 시스템',
                        ts: moment().unix()
                    }
                ]
            };

            return await this.sendMessage('', message);
        } catch (error) {
            console.error('일일점검 페이지 생성 알림 실패:', error);
            throw error;
        }
    }

    /**
     * 매일 아침 일일점검 페이지 알림
     */
    async sendDailyMorningNotification(pageInfo, date) {
        try {
            const dateStr = date.format('YYYY-MM-DD');
            const dayOfWeek = this.getKoreanDayOfWeek(date.day());

            const message = {
                channel: this.channel,
                username: '일일점검봇',
                icon_emoji: ':sunny:',
                attachments: [
                    {
                        color: '#2eb886',
                        pretext: '🌅 좋은 아침입니다! 오늘의 일일점검을 시작해주세요.',
                        title: `📋 ${dateStr} 개발팀 일일점검`,
                        title_link: pageInfo.url,
                        fields: [
                            {
                                title: '오늘 날짜',
                                value: `${dateStr} (${dayOfWeek})`,
                                short: true
                            },
                            {
                                title: '점검 시작 시간',
                                value: moment().tz(this.timezone).format('HH:mm'),
                                short: true
                            },
                            {
                                title: '점검 페이지',
                                value: `<${pageInfo.url}|📝 일일점검 페이지로 이동>`,
                                short: false
                            }
                        ],
                        footer: '개발팀 일일점검 자동화 시스템',
                        ts: moment().unix()
                    }
                ]
            };

            return await this.sendMessage('', message);
        } catch (error) {
            console.error('아침 일일점검 알림 실패:', error);
            throw error;
        }
    }

    /**
     * 에러 발생 알림
     */
    async notifyError(error, context = '') {
        try {
            const errorMessage = error.message || error;
            const currentTime = moment().tz(this.timezone).format('YYYY-MM-DD HH:mm:ss');

            const message = {
                channel: this.channel,
                username: '일일점검봇',
                icon_emoji: ':warning:',
                attachments: [
                    {
                        color: 'danger',
                        title: '🚨 일일점검 자동화 시스템 오류 발생',
                        fields: [
                            {
                                title: '발생 시간',
                                value: currentTime,
                                short: true
                            },
                            {
                                title: '컨텍스트',
                                value: context || '알 수 없음',
                                short: true
                            },
                            {
                                title: '오류 내용',
                                value: `\`\`\`${errorMessage}\`\`\``,
                                short: false
                            }
                        ],
                        footer: '개발팀 일일점검 자동화 시스템',
                        ts: moment().unix()
                    }
                ]
            };

            return await this.sendMessage('', message);
        } catch (slackError) {
            console.error('Slack 에러 알림 전송 실패:', slackError);
            // Slack 알림 전송도 실패한 경우 콘솔에만 로그 출력
            console.error('원본 에러:', error);
        }
    }

    /**
     * 영업일이 아닌 경우 알림 (선택사항 - 필요시 사용)
     */
    async notifyNonTradingDay(date, reason = '') {
        try {
            const dateStr = date.format('YYYY-MM-DD');
            const dayOfWeek = this.getKoreanDayOfWeek(date.day());

            const message = {
                channel: this.channel,
                username: '일일점검봇',
                icon_emoji: ':calendar:',
                attachments: [
                    {
                        color: '#36a64f',
                        title: `📅 ${dateStr}는 영업일이 아닙니다`,
                        fields: [
                            {
                                title: '날짜',
                                value: `${dateStr} (${dayOfWeek})`,
                                short: true
                            },
                            {
                                title: '구분',
                                value: reason || '주말 또는 공휴일',
                                short: true
                            },
                            {
                                title: '안내',
                                value: '일일점검 페이지가 생성되지 않습니다.',
                                short: false
                            }
                        ],
                        footer: '개발팀 일일점검 자동화 시스템',
                        ts: moment().unix()
                    }
                ]
            };

            return await this.sendMessage('', message);
        } catch (error) {
            console.error('비영업일 알림 실패:', error);
            throw error;
        }
    }

    /**
     * 시스템 상태 알림
     */
    async notifySystemStatus(status, details = {}) {
        try {
            const currentTime = moment().tz(this.timezone).format('YYYY-MM-DD HH:mm:ss');

            let color = '#36a64f'; // 기본 녹색
            let emoji = ':white_check_mark:';

            if (status === 'warning') {
                color = 'warning';
                emoji = ':warning:';
            } else if (status === 'error') {
                color = 'danger';
                emoji = ':x:';
            }

            const message = {
                channel: this.channel,
                username: '일일점검봇',
                icon_emoji: ':robot_face:',
                attachments: [
                    {
                        color: color,
                        title: `${emoji} 일일점검 자동화 시스템 상태`,
                        fields: [
                            {
                                title: '상태 확인 시간',
                                value: currentTime,
                                short: true
                            },
                            {
                                title: '시스템 상태',
                                value: status === 'ok' ? '정상 동작' : status === 'warning' ? '주의 필요' : '오류 발생',
                                short: true
                            },
                            ...Object.entries(details).map(([key, value]) => ({
                                title: key,
                                value: value,
                                short: true
                            }))
                        ],
                        footer: '개발팀 일일점검 자동화 시스템',
                        ts: moment().unix()
                    }
                ]
            };

            return await this.sendMessage('', message);
        } catch (error) {
            console.error('시스템 상태 알림 실패:', error);
            throw error;
        }
    }

    /**
     * 한국어 요일 반환
     */
    getKoreanDayOfWeek(day) {
        const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        return days[day];
    }

    /**
     * Webhook URL 유효성 검사
     */
    isConfigured() {
        return !!this.webhookUrl && this.webhookUrl.startsWith('https://hooks.slack.com/');
    }
}

module.exports = SlackService;