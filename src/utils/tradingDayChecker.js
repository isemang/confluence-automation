const moment = require('moment-timezone');
const EnhancedTradingDayChecker = require('./enhancedTradingDayChecker');

class TradingDayChecker {
    constructor() {
        this.timezone = process.env.TIMEZONE || 'Asia/Seoul';
        this.useEnhancedAPI = process.env.USE_ENHANCED_API !== 'false'; // 기본값: true

        // Enhanced API checker 초기화
        if (this.useEnhancedAPI) {
            this.enhancedChecker = new EnhancedTradingDayChecker();
            // 초기 캐시 로드 시도 (비동기이지만 백그라운드에서 실행)
            this.enhancedChecker.getHolidays().catch(error => {
                console.warn('Enhanced API 초기화 실패, 폴백 모드로 전환:', error.message);
            });
        }

        // 폴백용 한국거래소 공휴일 (Enhanced API 실패시 사용)
        this.holidays2024 = [
            '2024-01-01', // 신정
            '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12', // 설날 연휴
            '2024-03-01', // 삼일절
            '2024-04-10', // 국회의원선거
            '2024-05-05', // 어린이날
            '2024-05-06', // 대체휴일 (어린이날)
            '2024-05-15', // 부처님오신날
            '2024-06-06', // 현충일
            '2024-08-15', // 광복절
            '2024-09-16', '2024-09-17', '2024-09-18', // 추석 연휴
            '2024-10-03', // 개천절
            '2024-10-09', // 한글날
            '2024-12-25' // 크리스마스
        ];

        this.holidays2025 = [
            '2025-01-01', // 신정
            '2025-01-28', '2025-01-29', '2025-01-30', // 설날 연휴
            '2025-03-01', // 삼일절
            '2025-03-03', // 대체휴일
            '2025-05-05', // 어린이날
            '2025-05-13', // 부처님오신날
            '2025-06-06', // 현충일
            '2025-08-15', // 광복절
            '2025-10-03', // 개천절
            '2025-10-06', '2025-10-07', '2025-10-08', // 추석 연휴
            '2025-10-09', // 한글날
            '2025-12-25' // 크리스마스
        ];

        this.holidays2026 = [
            '2026-01-01', // 신정
            '2026-02-16', '2026-02-17', '2026-02-18', // 설날 연휴
            '2026-03-01', // 삼일절
            '2026-05-02', // 부처님오신날
            '2026-05-05', // 어린이날
            '2026-06-06', // 현충일
            '2026-08-15', // 광복절
            '2026-09-24', '2026-09-25', '2026-09-26', // 추석 연휴
            '2026-10-03', // 개천절
            '2026-10-09', // 한글날
            '2026-12-25' // 크리스마스
        ];

        this.allHolidays = [
            ...this.holidays2024,
            ...this.holidays2025,
            ...this.holidays2026
        ];
    }

    /**
     * 주어진 날짜가 영업일인지 확인 (동기식)
     * Enhanced API가 활성화되어 있으면 캐시된 데이터 우선 사용
     * @param {string|Date|moment} date - 확인할 날짜
     * @returns {boolean} 영업일 여부
     */
    isTradingDay(date) {
        if (this.useEnhancedAPI && this.enhancedChecker) {
            // Enhanced API의 동기식 메서드 사용 (캐시된 데이터 우선)
            return this.enhancedChecker.isTradingDaySync(date);
        }

        // 폴백: 기존 하드코딩 방식
        return this.isTradingDayFallback(date);
    }

    /**
     * 주어진 날짜가 영업일인지 확인 (비동기식 - Enhanced API 전용)
     * @param {string|Date|moment} date - 확인할 날짜
     * @returns {Promise<boolean>} 영업일 여부
     */
    async isTradingDayAsync(date) {
        if (this.useEnhancedAPI && this.enhancedChecker) {
            return await this.enhancedChecker.isTradingDay(date);
        }

        // 폴백: 기존 방식
        return this.isTradingDayFallback(date);
    }

    /**
     * 폴백 방식: 하드코딩된 공휴일 데이터로 영업일 확인
     * @param {string|Date|moment} date - 확인할 날짜
     * @returns {boolean} 영업일 여부
     */
    isTradingDayFallback(date) {
        const momentDate = moment(date).tz(this.timezone);
        const dayOfWeek = momentDate.day(); // 0: 일요일, 6: 토요일
        const dateString = momentDate.format('YYYY-MM-DD');

        // 주말 체크
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return false;
        }

        // 공휴일 체크
        if (this.allHolidays.includes(dateString)) {
            return false;
        }

        return true;
    }

    /**
     * 오늘이 영업일인지 확인 (동기식)
     * @returns {boolean} 영업일 여부
     */
    isTodayTradingDay() {
        if (this.useEnhancedAPI && this.enhancedChecker) {
            return this.enhancedChecker.isTodayTradingDaySync();
        }
        return this.isTradingDay(moment().tz(this.timezone));
    }

    /**
     * 오늘이 영업일인지 확인 (비동기식)
     * @returns {Promise<boolean>} 영업일 여부
     */
    async isTodayTradingDayAsync() {
        if (this.useEnhancedAPI && this.enhancedChecker) {
            return await this.enhancedChecker.isTodayTradingDay();
        }
        return this.isTradingDay(moment().tz(this.timezone));
    }

    /**
     * 다음 영업일 구하기
     * @param {string|Date|moment} date - 기준 날짜
     * @returns {moment} 다음 영업일
     */
    getNextTradingDay(date) {
        let nextDay = moment(date).tz(this.timezone).add(1, 'day');

        while (!this.isTradingDay(nextDay)) {
            nextDay = nextDay.add(1, 'day');
        }

        return nextDay;
    }

    /**
     * 이전 영업일 구하기
     * @param {string|Date|moment} date - 기준 날짜
     * @returns {moment} 이전 영업일
     */
    getPreviousTradingDay(date) {
        let prevDay = moment(date).tz(this.timezone).subtract(1, 'day');

        while (!this.isTradingDay(prevDay)) {
            prevDay = prevDay.subtract(1, 'day');
        }

        return prevDay;
    }

    /**
     * 현재 시점 기준 오늘 날짜 (한국 시간) 반환
     * @returns {moment} 오늘 날짜
     */
    getTodayInKST() {
        return moment().tz(this.timezone);
    }

    /**
     * Enhanced API 휴일 데이터 캐시 새로고침
     * @returns {Promise<Object>} 새로고침된 휴일 데이터
     */
    async refreshHolidayData() {
        if (this.useEnhancedAPI && this.enhancedChecker) {
            console.log('Enhanced API 휴일 데이터 새로고침 시작...');
            return await this.enhancedChecker.refreshCache();
        }
        console.log('Enhanced API가 비활성화되어 있어 새로고침할 수 없습니다.');
        return null;
    }

    /**
     * 캐시 상태 정보 반환
     * @returns {Object|null} 캐시 상태 정보
     */
    getCacheInfo() {
        if (this.useEnhancedAPI && this.enhancedChecker) {
            return this.enhancedChecker.getCacheInfo();
        }
        return null;
    }

    /**
     * Enhanced API 사용 여부 반환
     * @returns {boolean} Enhanced API 사용 여부
     */
    isEnhancedAPIEnabled() {
        return this.useEnhancedAPI;
    }

    /**
     * Enhanced API 강제 활성화/비활성화
     * @param {boolean} enabled - 활성화 여부
     */
    setEnhancedAPI(enabled) {
        this.useEnhancedAPI = enabled;
        if (enabled && !this.enhancedChecker) {
            this.enhancedChecker = new EnhancedTradingDayChecker();
        }
    }
}

module.exports = TradingDayChecker;