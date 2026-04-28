const moment = require('moment-timezone');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class EnhancedTradingDayChecker {
    constructor() {
        this.timezone = process.env.TIMEZONE || 'Asia/Seoul';
        this.cacheDir = path.join(__dirname, '..', '..', 'cache');
        this.cacheFile = path.join(this.cacheDir, 'holidays.json');
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24시간 (밀리초)

        // 폴백용 하드코딩된 공휴일 데이터 (최소한의 데이터)
        this.fallbackHolidays = this.getFallbackHolidays();

        // 캐시된 휴일 데이터
        this.cachedHolidays = null;
        this.lastCacheUpdate = null;
    }

    /**
     * 폴백용 기본 공휴일 데이터 (최신 데이터로 주기적 업데이트 필요)
     */
    getFallbackHolidays() {
        return {
            '2024': [
                '2024-01-01', '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12',
                '2024-03-01', '2024-04-10', '2024-05-05', '2024-05-06', '2024-05-15',
                '2024-06-06', '2024-08-15', '2024-09-16', '2024-09-17', '2024-09-18',
                '2024-10-03', '2024-10-09', '2024-12-25'
            ],
            '2025': [
                '2025-01-01', '2025-01-27', '2025-01-28', '2025-01-29', '2025-01-30',
                '2025-03-01', '2025-03-03', '2025-05-05', '2025-05-13', '2025-06-06',
                '2025-08-15', '2025-10-03', '2025-10-06', '2025-10-07', '2025-10-08',
                '2025-10-09', '2025-12-25', '2025-12-31'
            ],
            '2026': [
                '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01',
                '2026-05-02', '2026-05-05', '2026-06-06', '2026-08-15', '2026-09-24',
                '2026-09-25', '2026-09-26', '2026-10-03', '2026-10-09', '2026-12-25'
            ]
        };
    }

    /**
     * 캐시 디렉토리 생성
     */
    async ensureCacheDirectory() {
        try {
            await fs.access(this.cacheDir);
        } catch {
            await fs.mkdir(this.cacheDir, { recursive: true });
        }
    }

    /**
     * 한국거래소 홈페이지에서 휴장일 데이터 크롤링
     */
    async fetchKRXHolidays(year) {
        try {
            const url = `http://marketdata.krx.co.kr/contents/COM/GenerateOTP.jspx`;

            // KRX의 실제 API 호출 방식은 복잡하므로,
            // 여기서는 공개 API나 다른 신뢰할 수 있는 소스를 사용하는 예시를 보여줍니다.

            console.log(`KRX 휴장일 데이터 조회 시도 중... (${year}년)`);

            // 실제 구현에서는 KRX의 정확한 API 엔드포인트와 인증 방식이 필요
            // 현재는 mock 데이터로 대체
            return await this.fetchPublicHolidayAPI(year);

        } catch (error) {
            console.warn(`KRX 휴장일 데이터 조회 실패 (${year}):`, error.message);
            return null;
        }
    }

    /**
     * 공공 휴일 API에서 데이터 가져오기 (한국천문연구원 등)
     */
    async fetchPublicHolidayAPI(year) {
        try {
            // 한국천문연구원 특일 정보 API (공공데이터)
            const apiKey = process.env.KOREA_ASTRONOMY_API_KEY;
            if (!apiKey) {
                console.warn('한국천문연구원 API 키가 설정되지 않음');
                return null;
            }

            const url = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
            const params = {
                serviceKey: apiKey,
                pageNo: '1',
                numOfRows: '100',
                solYear: year,
                _type: 'json'
            };

            const response = await axios.get(url, {
                params,
                timeout: 10000
            });

            if (response.data?.response?.body?.items?.item) {
                const holidays = response.data.response.body.items.item.map(item => {
                    const date = item.locdate.toString();
                    return `${date.substr(0,4)}-${date.substr(4,2)}-${date.substr(6,2)}`;
                });

                console.log(`공공 휴일 API에서 ${year}년 공휴일 ${holidays.length}개 조회`);
                return holidays;
            }

            return null;
        } catch (error) {
            console.warn(`공공 휴일 API 조회 실패 (${year}):`, error.message);
            return null;
        }
    }

    /**
     * 한국거래소 추가 휴장일 가져오기 (연말 특별 휴장일 등)
     */
    async fetchKRXSpecialHolidays(year) {
        try {
            // 한국거래소의 특별 휴장일 (연말 등)
            const specialHolidays = {
                '2025': ['2025-12-31'], // 2025년 연말 휴장
                '2026': [], // 아직 발표되지 않음
            };

            return specialHolidays[year.toString()] || [];
        } catch (error) {
            console.warn(`KRX 특별 휴장일 조회 실패 (${year}):`, error.message);
            return [];
        }
    }

    /**
     * 여러 소스에서 휴일 데이터 수집
     */
    async fetchHolidaysFromMultipleSources(year) {
        const sources = await Promise.allSettled([
            this.fetchPublicHolidayAPI(year),
            this.fetchKRXSpecialHolidays(year),
            // 필요시 추가 소스들 여기에 추가
        ]);

        const allHolidays = new Set();

        // 각 소스의 결과 병합
        sources.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                if (Array.isArray(result.value)) {
                    result.value.forEach(holiday => allHolidays.add(holiday));
                }
            }
        });

        // 폴백 데이터 추가
        const fallbackData = this.fallbackHolidays[year.toString()];
        if (fallbackData) {
            fallbackData.forEach(holiday => allHolidays.add(holiday));
        }

        return Array.from(allHolidays).sort();
    }

    /**
     * 캐시에서 휴일 데이터 로드
     */
    async loadCachedHolidays() {
        try {
            const cacheData = await fs.readFile(this.cacheFile, 'utf8');
            const parsed = JSON.parse(cacheData);

            // 캐시 유효성 검사
            if (parsed.timestamp && (Date.now() - parsed.timestamp < this.cacheExpiry)) {
                this.cachedHolidays = parsed.holidays;
                this.lastCacheUpdate = parsed.timestamp;
                console.log('캐시된 휴일 데이터 로드 완료');
                return true;
            } else {
                console.log('캐시 데이터가 만료됨');
                return false;
            }
        } catch (error) {
            console.log('캐시 파일 로드 실패 또는 존재하지 않음');
            return false;
        }
    }

    /**
     * 휴일 데이터를 캐시에 저장
     */
    async saveCachedHolidays(holidays) {
        try {
            await this.ensureCacheDirectory();

            const cacheData = {
                timestamp: Date.now(),
                holidays: holidays,
                source: 'multiple-api-sources',
                version: '2.0'
            };

            await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
            this.cachedHolidays = holidays;
            this.lastCacheUpdate = cacheData.timestamp;

            console.log('휴일 데이터 캐시 저장 완료');
        } catch (error) {
            console.error('캐시 저장 실패:', error.message);
        }
    }

    /**
     * 최신 휴일 데이터 가져오기 (캐시 우선, API 폴백)
     */
    async getHolidays() {
        // 캐시된 데이터가 있고 유효하면 사용
        if (this.cachedHolidays && this.lastCacheUpdate &&
            (Date.now() - this.lastCacheUpdate < this.cacheExpiry)) {
            return this.cachedHolidays;
        }

        // 캐시에서 로드 시도
        const cacheLoaded = await this.loadCachedHolidays();
        if (cacheLoaded && this.cachedHolidays) {
            return this.cachedHolidays;
        }

        console.log('휴일 데이터 업데이트 중...');

        try {
            // 현재 연도부터 향후 2년까지 데이터 수집
            const currentYear = moment().year();
            const years = [currentYear, currentYear + 1, currentYear + 2];

            const allHolidays = {};

            for (const year of years) {
                console.log(`${year}년 휴일 데이터 수집 중...`);
                const yearHolidays = await this.fetchHolidaysFromMultipleSources(year);
                allHolidays[year] = yearHolidays;
            }

            // 성공적으로 데이터를 가져온 경우 캐시에 저장
            await this.saveCachedHolidays(allHolidays);

            return allHolidays;

        } catch (error) {
            console.error('휴일 데이터 업데이트 실패:', error.message);

            // API 실패시 폴백 데이터 사용
            console.log('폴백 데이터로 전환');
            return this.fallbackHolidays;
        }
    }

    /**
     * 주어진 날짜가 영업일인지 확인
     */
    async isTradingDay(date) {
        const momentDate = moment(date).tz(this.timezone);
        const dayOfWeek = momentDate.day(); // 0: 일요일, 6: 토요일
        const dateString = momentDate.format('YYYY-MM-DD');
        const year = momentDate.year();

        // 주말 체크
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return false;
        }

        // 휴일 데이터 가져오기
        const holidays = await this.getHolidays();
        const yearHolidays = holidays[year] || holidays[year.toString()] || [];

        // 공휴일 체크
        if (yearHolidays.includes(dateString)) {
            return false;
        }

        return true;
    }

    /**
     * 오늘이 영업일인지 확인
     */
    async isTodayTradingDay() {
        return await this.isTradingDay(moment().tz(this.timezone));
    }

    /**
     * 다음 영업일 구하기
     */
    async getNextTradingDay(date) {
        let nextDay = moment(date).tz(this.timezone).add(1, 'day');

        while (!(await this.isTradingDay(nextDay))) {
            nextDay = nextDay.add(1, 'day');
        }

        return nextDay;
    }

    /**
     * 이전 영업일 구하기
     */
    async getPreviousTradingDay(date) {
        let prevDay = moment(date).tz(this.timezone).subtract(1, 'day');

        while (!(await this.isTradingDay(prevDay))) {
            prevDay = prevDay.subtract(1, 'day');
        }

        return prevDay;
    }

    /**
     * 현재 시점 기준 오늘 날짜 (한국 시간) 반환
     */
    getTodayInKST() {
        return moment().tz(this.timezone);
    }

    /**
     * 캐시 상태 정보 반환
     */
    getCacheInfo() {
        return {
            cacheFile: this.cacheFile,
            lastUpdate: this.lastCacheUpdate ? new Date(this.lastCacheUpdate).toISOString() : null,
            isValid: this.lastCacheUpdate && (Date.now() - this.lastCacheUpdate < this.cacheExpiry),
            expiryTime: this.lastCacheUpdate ? new Date(this.lastCacheUpdate + this.cacheExpiry).toISOString() : null
        };
    }

    /**
     * 캐시 강제 새로고침
     */
    async refreshCache() {
        console.log('캐시 강제 새로고침 시작...');
        this.cachedHolidays = null;
        this.lastCacheUpdate = null;

        try {
            await fs.unlink(this.cacheFile);
            console.log('기존 캐시 파일 삭제');
        } catch {
            // 파일이 없으면 무시
        }

        return await this.getHolidays();
    }

    /**
     * 동기식 영업일 확인 (기존 API 호환성 유지)
     * 캐시된 데이터만 사용하고, 없으면 폴백 데이터 사용
     */
    isTradingDaySync(date) {
        const momentDate = moment(date).tz(this.timezone);
        const dayOfWeek = momentDate.day();
        const dateString = momentDate.format('YYYY-MM-DD');
        const year = momentDate.year();

        // 주말 체크
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return false;
        }

        // 캐시된 데이터 우선 사용
        let yearHolidays = [];
        if (this.cachedHolidays && this.cachedHolidays[year]) {
            yearHolidays = this.cachedHolidays[year];
        } else {
            // 폴백 데이터 사용
            yearHolidays = this.fallbackHolidays[year.toString()] || [];
        }

        return !yearHolidays.includes(dateString);
    }

    /**
     * 동기식 오늘 영업일 확인
     */
    isTodayTradingDaySync() {
        return this.isTradingDaySync(moment().tz(this.timezone));
    }
}

module.exports = EnhancedTradingDayChecker;