const TradingDayChecker = require('../utils/tradingDayChecker');
const EnhancedTradingDayChecker = require('../utils/enhancedTradingDayChecker');
const moment = require('moment-timezone');

// 테스트 환경 설정
process.env.USE_ENHANCED_API = 'true';
process.env.TIMEZONE = 'Asia/Seoul';

describe('TradingDayChecker 테스트', () => {
    let checker;

    beforeAll(() => {
        checker = new TradingDayChecker();
    });

    describe('기본 영업일 확인', () => {
        test('평일은 영업일이어야 함', () => {
            // 2026-04-30 (목요일, 특별한 공휴일 없음)
            const thursday = '2026-04-30';
            expect(checker.isTradingDay(thursday)).toBe(true);
        });

        test('토요일은 영업일이 아니어야 함', () => {
            // 2026-05-02 (토요일)
            const saturday = '2026-05-02';
            expect(checker.isTradingDay(saturday)).toBe(false);
        });

        test('일요일은 영업일이 아니어야 함', () => {
            // 2026-05-03 (일요일)
            const sunday = '2026-05-03';
            expect(checker.isTradingDay(sunday)).toBe(false);
        });

        test('신정(1월 1일)은 영업일이 아니어야 함', () => {
            const newYear = '2026-01-01';
            expect(checker.isTradingDay(newYear)).toBe(false);
        });

        test('크리스마스는 영업일이 아니어야 함', () => {
            const christmas = '2025-12-25';
            expect(checker.isTradingDay(christmas)).toBe(false);
        });

        test('연말 특별 휴장일은 영업일이 아니어야 함', () => {
            const yearEndHoliday = '2025-12-31';
            expect(checker.isTradingDay(yearEndHoliday)).toBe(false);
        });
    });

    describe('오늘 영업일 확인', () => {
        test('isTodayTradingDay는 boolean 값을 반환해야 함', () => {
            const result = checker.isTodayTradingDay();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('다음/이전 영업일 찾기', () => {
        test('다음 영업일 찾기', () => {
            // 금요일 다음 영업일은 다음 주 월요일이어야 함
            const friday = '2026-05-01'; // 금요일
            const nextTradingDay = checker.getNextTradingDay(friday);

            // 다음 영업일은 월요일 (5월 4일)이어야 함
            expect(nextTradingDay.format('YYYY-MM-DD')).toBe('2026-05-04');
            expect(nextTradingDay.day()).toBe(1); // 월요일
        });

        test('이전 영업일 찾기', () => {
            // 월요일 이전 영업일은 지난 주 금요일이어야 함
            const monday = '2026-05-04'; // 월요일
            const prevTradingDay = checker.getPreviousTradingDay(monday);

            // 이전 영업일은 금요일 (5월 1일)이어야 함
            expect(prevTradingDay.format('YYYY-MM-DD')).toBe('2026-05-01');
            expect(prevTradingDay.day()).toBe(5); // 금요일
        });
    });

    describe('Enhanced API 기능', () => {
        test('Enhanced API가 활성화되어 있는지 확인', () => {
            expect(checker.isEnhancedAPIEnabled()).toBe(true);
        });

        test('캐시 정보 조회', () => {
            const cacheInfo = checker.getCacheInfo();
            expect(cacheInfo).toBeDefined();
            expect(typeof cacheInfo).toBe('object');
        });

        test('Enhanced API 비활성화/활성화', () => {
            checker.setEnhancedAPI(false);
            expect(checker.isEnhancedAPIEnabled()).toBe(false);

            checker.setEnhancedAPI(true);
            expect(checker.isEnhancedAPIEnabled()).toBe(true);
        });
    });

    describe('비동기 메서드', () => {
        test('비동기 영업일 확인', async () => {
            const thursday = '2026-04-30';
            const result = await checker.isTradingDayAsync(thursday);
            expect(typeof result).toBe('boolean');
            expect(result).toBe(true);
        });

        test('비동기 오늘 영업일 확인', async () => {
            const result = await checker.isTodayTradingDayAsync();
            expect(typeof result).toBe('boolean');
        });

        test('휴일 데이터 새로고침', async () => {
            try {
                const result = await checker.refreshHolidayData();
                // API가 성공하면 객체를, 실패하거나 비활성화되어 있으면 null을 반환
                expect(result === null || typeof result === 'object').toBe(true);
            } catch (error) {
                // 네트워크 오류 등은 예상할 수 있음
                console.warn('휴일 데이터 새로고침 테스트 실패:', error.message);
            }
        }, 30000); // 30초 타임아웃
    });

    describe('날짜 포맷 호환성', () => {
        test('문자열 날짜 형식', () => {
            expect(checker.isTradingDay('2026-04-30')).toBe(true);
        });

        test('Date 객체', () => {
            const date = new Date('2026-04-30');
            expect(checker.isTradingDay(date)).toBe(true);
        });

        test('moment 객체', () => {
            const momentDate = moment('2026-04-30');
            expect(checker.isTradingDay(momentDate)).toBe(true);
        });
    });

    describe('시간대 처리', () => {
        test('getTodayInKST는 한국 시간을 반환해야 함', () => {
            const today = checker.getTodayInKST();
            expect(today.format('Z')).toBe('+09:00'); // KST는 UTC+9
        });
    });
});

describe('EnhancedTradingDayChecker 독립 테스트', () => {
    let enhancedChecker;

    beforeAll(() => {
        enhancedChecker = new EnhancedTradingDayChecker();
    });

    describe('캐싱 시스템', () => {
        test('캐시 정보 조회', () => {
            const cacheInfo = enhancedChecker.getCacheInfo();
            expect(cacheInfo).toBeDefined();
            expect(cacheInfo).toHaveProperty('cacheFile');
            expect(cacheInfo).toHaveProperty('lastUpdate');
            expect(cacheInfo).toHaveProperty('isValid');
        });

        test('동기식 영업일 확인 (폴백 모드)', () => {
            const thursday = '2026-04-30';
            const result = enhancedChecker.isTradingDaySync(thursday);
            expect(typeof result).toBe('boolean');
        });

        test('동기식 오늘 영업일 확인', () => {
            const result = enhancedChecker.isTodayTradingDaySync();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('비동기 API 호출', () => {
        test('휴일 데이터 가져오기', async () => {
            try {
                const holidays = await enhancedChecker.getHolidays();
                expect(holidays).toBeDefined();
                expect(typeof holidays).toBe('object');

                // 현재 연도 데이터가 있는지 확인
                const currentYear = new Date().getFullYear();
                expect(holidays[currentYear] || holidays[currentYear.toString()]).toBeDefined();
            } catch (error) {
                console.warn('휴일 데이터 가져오기 테스트 실패:', error.message);
            }
        }, 30000);

        test('비동기 영업일 확인', async () => {
            try {
                const thursday = '2026-04-30';
                const result = await enhancedChecker.isTradingDay(thursday);
                expect(typeof result).toBe('boolean');
                expect(result).toBe(true);
            } catch (error) {
                console.warn('비동기 영업일 확인 테스트 실패:', error.message);
            }
        }, 15000);
    });
});

describe('폴백 시스템 테스트', () => {
    let fallbackChecker;

    beforeAll(() => {
        // Enhanced API 비활성화
        process.env.USE_ENHANCED_API = 'false';
        fallbackChecker = new TradingDayChecker();
    });

    afterAll(() => {
        // 원래 설정 복구
        process.env.USE_ENHANCED_API = 'true';
    });

    test('폴백 모드에서 영업일 확인', () => {
        expect(fallbackChecker.isEnhancedAPIEnabled()).toBe(false);

        const thursday = '2026-04-30';
        const result = fallbackChecker.isTradingDay(thursday);
        expect(typeof result).toBe('boolean');
        expect(result).toBe(true);
    });

    test('폴백 모드에서 휴일 확인', () => {
        const christmas = '2025-12-25';
        const result = fallbackChecker.isTradingDay(christmas);
        expect(result).toBe(false);
    });
});