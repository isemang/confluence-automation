const axios = require('axios');
const moment = require('moment-timezone');

class ConfluenceService {
    constructor() {
        this.baseURL = process.env.CONFLUENCE_BASE_URL;
        this.username = process.env.CONFLUENCE_USERNAME;
        this.apiToken = process.env.CONFLUENCE_API_TOKEN;
        this.parentPageId = process.env.CONFLUENCE_PARENT_PAGE_ID;
        this.timezone = process.env.TIMEZONE || 'Asia/Seoul';

        this.client = axios.create({
            baseURL: `${this.baseURL}/wiki/rest/api`,
            auth: {
                username: this.username,
                password: this.apiToken
            },
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * 페이지 검색
     */
    async searchPages(title, spaceKey = null) {
        try {
            const params = {
                title: title,
                expand: 'space,ancestors,children'
            };
            if (spaceKey) {
                params.spaceKey = spaceKey;
            }

            const response = await this.client.get('/content', { params });
            return response.data.results;
        } catch (error) {
            console.error('페이지 검색 실패:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 페이지 ID로 페이지 정보 가져오기
     */
    async getPageById(pageId) {
        try {
            const response = await this.client.get(`/content/${pageId}`, {
                params: {
                    expand: 'space,ancestors,children'
                }
            });
            return response.data;
        } catch (error) {
            console.error('페이지 조회 실패:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 자식 페이지들 가져오기
     */
    async getChildPages(parentId) {
        try {
            const response = await this.client.get(`/content/${parentId}/child/page`);
            return response.data.results;
        } catch (error) {
            console.error('자식 페이지 조회 실패:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 페이지 생성
     */
    async createPage(title, content, parentId, spaceKey) {
        try {
            const pageData = {
                type: 'page',
                title: title,
                space: {
                    key: spaceKey
                },
                body: {
                    storage: {
                        value: content,
                        representation: 'storage'
                    }
                },
                ancestors: [
                    {
                        id: parentId
                    }
                ]
            };

            const response = await this.client.post('/content', pageData);
            return response.data;
        } catch (error) {
            console.error('페이지 생성 실패:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 페이지 구조 확인 및 생성
     * 개발팀 홈 > 일일점검페이지 > yyyy년 > mm월 구조 확인/생성
     */
    async ensurePageStructure(date) {
        try {
            const year = date.format('YYYY');
            const month = date.format('MM');

            // 1. 개발팀 홈 페이지 확인 (기본적으로 존재한다고 가정)
            const devTeamHome = await this.getPageById(this.parentPageId);
            const spaceKey = devTeamHome.space.key;

            // 2. "일일점검페이지" 확인/생성
            let dailyCheckPage = await this.findOrCreatePage(
                '일일점검페이지',
                this.generateDailyCheckPageContent(),
                this.parentPageId,
                spaceKey
            );

            // 3. "yyyy년" 페이지 확인/생성
            let yearPage = await this.findOrCreatePage(
                `${year}년`,
                this.generateYearPageContent(year),
                dailyCheckPage.id,
                spaceKey
            );

            // 4. "mm월" 페이지 확인/생성
            let monthPage = await this.findOrCreatePage(
                `${month}월`,
                this.generateMonthPageContent(year, month),
                yearPage.id,
                spaceKey
            );

            return {
                devTeamHome,
                dailyCheckPage,
                yearPage,
                monthPage,
                spaceKey
            };
        } catch (error) {
            console.error('페이지 구조 확인/생성 실패:', error);
            throw error;
        }
    }

    /**
     * 페이지 찾기 또는 생성
     */
    async findOrCreatePage(title, content, parentId, spaceKey) {
        try {
            // 자식 페이지들에서 해당 제목의 페이지 찾기
            const childPages = await this.getChildPages(parentId);
            const existingPage = childPages.find(page => page.title === title);

            if (existingPage) {
                return existingPage;
            }

            // 페이지가 없으면 생성
            return await this.createPage(title, content, parentId, spaceKey);
        } catch (error) {
            console.error(`페이지 찾기/생성 실패 (${title}):`, error);
            throw error;
        }
    }

    /**
     * 일일점검 페이지 생성
     */
    async createDailyCheckPage(date) {
        try {
            const dateStr = date.format('YYYY-MM-DD');
            const title = `${dateStr} 개발팀 일일점검`;

            // 페이지 구조 확인/생성
            const structure = await this.ensurePageStructure(date);

            // 해당 날짜의 일일점검 페이지가 이미 있는지 확인
            const monthChildPages = await this.getChildPages(structure.monthPage.id);
            const existingDailyPage = monthChildPages.find(page => page.title === title);

            if (existingDailyPage) {
                console.log(`일일점검 페이지가 이미 존재합니다: ${title}`);
                return {
                    page: existingDailyPage,
                    url: `${this.baseURL}/wiki${existingDailyPage._links.webui}`,
                    isNew: false
                };
            }

            // 새 일일점검 페이지 생성
            const content = this.generateDailyCheckContent(date);
            const newPage = await this.createPage(title, content, structure.monthPage.id, structure.spaceKey);

            const pageUrl = `${this.baseURL}/wiki${newPage._links.webui}`;

            console.log(`일일점검 페이지가 생성되었습니다: ${title}`);
            console.log(`URL: ${pageUrl}`);

            return {
                page: newPage,
                url: pageUrl,
                isNew: true
            };
        } catch (error) {
            console.error('일일점검 페이지 생성 실패:', error);
            throw error;
        }
    }

    /**
     * 일일점검페이지 메인 내용 생성
     */
    generateDailyCheckPageContent() {
        return `<h1>개발팀 일일점검</h1>
<p>이 페이지는 개발팀의 일일점검 기록을 관리하는 메인 페이지입니다.</p>
<p>각 연도별, 월별로 구분되어 관리됩니다.</p>

<h2>점검 항목</h2>
<ul>
<li>시스템 상태 확인</li>
<li>배포 현황 점검</li>
<li>이슈 및 장애 현황</li>
<li>모니터링 지표 확인</li>
<li>보안 점검</li>
</ul>`;
    }

    /**
     * 연도 페이지 내용 생성
     */
    generateYearPageContent(year) {
        return `<h1>${year}년 개발팀 일일점검</h1>
<p>${year}년도 개발팀 일일점검 기록 페이지입니다.</p>
<p>월별로 구분되어 관리됩니다.</p>`;
    }

    /**
     * 월 페이지 내용 생성
     */
    generateMonthPageContent(year, month) {
        return `<h1>${year}년 ${month}월 개발팀 일일점검</h1>
<p>${year}년 ${month}월 개발팀 일일점검 기록 페이지입니다.</p>
<p>영업일별로 일일점검 페이지가 생성됩니다.</p>`;
    }

    /**
     * 일일점검 페이지 내용 생성
     */
    generateDailyCheckContent(date) {
        const dateStr = date.format('YYYY-MM-DD');
        const dayOfWeek = date.format('dddd');
        const koreanDayOfWeek = this.getKoreanDayOfWeek(date.day());

        return `<h1>${dateStr} 개발팀 일일점검</h1>
<p><strong>일시:</strong> ${dateStr} (${koreanDayOfWeek})</p>
<p><strong>점검자:</strong> </p>
<p><strong>점검시간:</strong> </p>

<h2>🔍 시스템 상태 확인</h2>
<table>
<tbody>
<tr>
<th>점검 항목</th>
<th>상태</th>
<th>비고</th>
</tr>
<tr>
<td>웹 서버</td>
<td>⭕ 정상 / ❌ 이상</td>
<td></td>
</tr>
<tr>
<td>API 서버</td>
<td>⭕ 정상 / ❌ 이상</td>
<td></td>
</tr>
<tr>
<td>데이터베이스</td>
<td>⭕ 정상 / ❌ 이상</td>
<td></td>
</tr>
<tr>
<td>캐시 서버</td>
<td>⭕ 정상 / ❌ 이상</td>
<td></td>
</tr>
</tbody>
</table>

<h2>📊 모니터링 지표</h2>
<table>
<tbody>
<tr>
<th>지표</th>
<th>현재값</th>
<th>기준값</th>
<th>상태</th>
</tr>
<tr>
<td>CPU 사용률</td>
<td>%</td>
<td>&lt; 80%</td>
<td>⭕ 정상 / ⚠️ 주의 / ❌ 이상</td>
</tr>
<tr>
<td>메모리 사용률</td>
<td>%</td>
<td>&lt; 85%</td>
<td>⭕ 정상 / ⚠️ 주의 / ❌ 이상</td>
</tr>
<tr>
<td>디스크 사용률</td>
<td>%</td>
<td>&lt; 90%</td>
<td>⭕ 정상 / ⚠️ 주의 / ❌ 이상</td>
</tr>
<tr>
<td>응답시간</td>
<td>ms</td>
<td>&lt; 500ms</td>
<td>⭕ 정상 / ⚠️ 주의 / ❌ 이상</td>
</tr>
</tbody>
</table>

<h2>🚀 배포 현황</h2>
<ul>
<li><strong>최근 배포:</strong> </li>
<li><strong>배포 일시:</strong> </li>
<li><strong>배포자:</strong> </li>
<li><strong>배포 내용:</strong> </li>
</ul>

<h2>⚠️ 이슈 및 장애 현황</h2>
<ul>
<li><strong>신규 이슈:</strong> </li>
<li><strong>진행 중인 이슈:</strong> </li>
<li><strong>해결된 이슈:</strong> </li>
</ul>

<h2>🔒 보안 점검</h2>
<ul>
<li><strong>보안 로그 확인:</strong> </li>
<li><strong>의심스러운 활동:</strong> </li>
<li><strong>보안 업데이트:</strong> </li>
</ul>

<h2>📝 특이사항</h2>
<p></p>

<h2>✅ 점검 완료</h2>
<p><strong>점검 완료 시간:</strong> </p>
<p><strong>다음 점검 예정일:</strong> </p>

---
<p><em>본 문서는 자동으로 생성되었습니다. (생성일시: ${moment().tz(this.timezone).format('YYYY-MM-DD HH:mm:ss')})</em></p>`;
    }

    /**
     * 한국어 요일 반환
     */
    getKoreanDayOfWeek(day) {
        const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        return days[day];
    }
}

module.exports = ConfluenceService;