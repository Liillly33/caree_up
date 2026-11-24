// Guided Strength/Weakness Assessment (선호직무TI) for 3-4학년 대학생.
const PTI_JOB_META = {
    FE:   { name: '프론트엔드개발', summary: '사용자 화면과 인터랙션을 직접 구현해 즉각적인 완성도를 만드는 직무입니다.' },
    BE:   { name: '백엔드/서버개발', summary: 'API, 데이터 모델, 비즈니스 로직을 설계해 서비스의 뼈대를 책임지는 직무입니다.' },
    APP:  { name: 'ios/android앱개발', summary: '모바일 환경의 사용성과 네이티브 기능을 살린 앱을 만드는 직무입니다.' },
    ERP:  { name: '시스템/ERP개발', summary: '기업 업무 흐름에 맞춰 안정적인 데이터 처리와 전사 시스템을 구축하는 직무입니다.' },
    OPS:  { name: 'DevOps/클라우드', summary: '빌드·배포 자동화와 클라우드 인프라 운영으로 개발 생산성과 안정성을 높입니다.' },
    SEC:  { name: '정보보안', summary: '시스템 취약점 점검, 권한 통제, 보안 위협 탐지로 서비스를 지키는 직무입니다.' },
    DATA: { name: '데이터/DB', summary: 'SQL·파이프라인·지표 설계를 통해 데이터를 신뢰할 수 있는 근거로 바꿉니다.' },
    AIML: { name: 'AI/ML엔지니어', summary: '모델 학습·실험·추론 서빙으로 지능형 기능을 서비스에 녹여내는 직무입니다.' },
    QA:   { name: 'QA/기술지원', summary: '예외 케이스 검증, 테스트 자동화, 품질 기준으로 서비스 완성도를 보증합니다.' },
    GAME: { name: '게임개발/기획', summary: '실시간 렌더링·물리·콘텐츠 로직으로 몰입감 있는 플레이 경험을 구현합니다.' },
    IOT:  { name: '임베디드/IoT시스템', summary: '하드웨어 센서·펌웨어·저수준 제어를 소프트웨어와 연결하는 직무입니다.' },
    NET:  { name: '네트워크엔지니어', summary: '패킷 흐름·인프라 통신·트러블슈팅으로 안정적인 연결망을 구축하는 직무입니다.' }
};

const PTI_STEPS = [
    {
        kicker: 'STEP 1 · 강점 탐색',
        title: '전공 수업이나 팀 프로젝트에서 가장 몰입했던 순간은?',
        subtitle: '3-4학년 경험을 떠올려 가장 자신 있게 해냈던 1~2가지를 골라주세요.',
        maxSelect: 2,
        options: [
            { id: 's1_ui', title: '화면 배치와 버튼·동선을 다듬고 결과를 바로 확인할 때', desc: 'HTML/CSS, React, 모바일 UI 등 눈에 보이는 구현이 재미있었어요.', scores: { FE: 4, APP: 3, GAME: 2 }, strength: '사용자 관점의 화면 구성과 직관적인 결과물 구현' },
            { id: 's1_api', title: '서버 API와 DB 구조를 짜고 기능이 매끄럽게 돌아갈 때', desc: '로그인, CRUD, 데이터 연결 등 보이지 않는 로직 설계가 편했어요.', scores: { BE: 4, ERP: 3, DATA: 2 }, strength: '서버 로직·데이터베이스 설계와 체계적인 흐름 구현' },
            { id: 's1_data', title: '데이터를 정리해 원인을 찾거나 AI 모델을 학습시켜 볼 때', desc: 'CSV/로그 분석, 통계 지표 확인, 모델 성능 개선이 흥미로웠어요.', scores: { DATA: 4, AIML: 4, BE: 1 }, strength: '데이터 기반 분석과 수치·모델 실험 역량' },
            { id: 's1_ops', title: '도커·클라우드·배포 환경을 세팅해 팀 작업을 편하게 만들 때', desc: 'GitHub Actions, Linux 서버, 실행 환경 통일에 강점이 있었어요.', scores: { OPS: 4, NET: 3, BE: 2 }, strength: '실행 환경 구성과 배포·인프라 자동화 감각' },
            { id: 's1_qa', title: '오류 원인을 끝까지 추적하고 예외 상황·보안 허점을 찾을 때', desc: '남들이 놓친 버그를 재현하거나 권한·입력값 검증을 꼼꼼히 봤어요.', scores: { QA: 4, SEC: 4, ERP: 1 }, strength: '꼼꼼한 예외 탐지와 시스템 신뢰성·보안 검증력' },
            { id: 's1_hw', title: 'C/C++·하드웨어 센서나 실시간 그래픽·게임을 직접 움직일 때', desc: '아두이노·임베디드 보드, 네트워크 소켓, 게임 엔진이 재미있었어요.', scores: { IOT: 4, GAME: 3, NET: 2 }, strength: '하드웨어·실시간 제어와 저수준 동작 이해' }
        ]
    },
    {
        kicker: 'STEP 2 · 취약점 탐색',
        title: '반대로, 진행할 때 가장 부담스럽거나 피하고 싶은 작업은?',
        subtitle: '취약하거나 성향과 안 맞는 영역을 빼야 실제 적성 직무가 선명해집니다. (최대 2개)',
        maxSelect: 2,
        options: [
            { id: 's2_css', title: '픽셀 단위 레이아웃 맞추기·색감/디자인 디테일 조정', desc: 'UI 감각이 필요한 화면 마무리가 유독 오래 걸리고 답답해요.', scores: { FE: -4, APP: -3, GAME: -2 }, weakness: '시각적 UI/CSS 디테일 작업에 대한 부담' },
            { id: 's2_math', title: '선형대수·확률통계 수식이나 AI 논문·실험 튜닝', desc: '수학 공식 유도나 모델 하이퍼파라미터 반복 실험이 부담스러워요.', scores: { AIML: -5, DATA: -2 }, weakness: '고난도 수학·통계 기반 모델링 부담' },
            { id: 's2_low', title: 'C/포인터·메모리 관리나 하드웨어 회로·레지스터 다루기', desc: '하드웨어 의존적인 디버깅이나 저수준 코드가 어렵게 느껴져요.', scores: { IOT: -5, GAME: -2, NET: -2 }, weakness: '저수준 메모리·하드웨어 제어에 대한 부담' },
            { id: 's2_infra', title: '리눅스 터미널·방화벽·네트워크 설정과 장애 대응', desc: '눈에 보이지 않는 인프라/서버 환경 설정 오류 잡기가 막막해요.', scores: { OPS: -4, NET: -5, SEC: -3, IOT: -2 }, weakness: '리눅스·네트워크 및 인프라 트러블슈팅 부담' },
            { id: 's2_doc', title: '반복적인 테스트 시나리오 작성과 꼼꼼한 절차 문서화', desc: '새 기능 구현보다 검증 체크리스트와 문서 정리가 지루하게 느껴져요.', scores: { QA: -4, ERP: -3 }, weakness: '반복 검증·정형화된 문서화 작업 부담' },
            { id: 's2_none', title: '특별히 피하고 싶은 영역 없이 두루 도전하는 편이에요', desc: '아직 특정 분야를 배제하기보다 강점 중심으로 추천받고 싶어요.', scores: {}, weakness: '특정 기술 영역에 대한 큰 거부감 없이 폭넓게 탐색 가능' }
        ]
    },
    {
        kicker: 'STEP 3 · 문제 해결 강점',
        title: '팀 프로젝트에서 예상치 못한 문제가 생겼을 때 나의 역할은?',
        subtitle: '위기 상황에서 자연스럽게 발휘되는 본인의 강점을 1개 선택해주세요.',
        maxSelect: 1,
        options: [
            { id: 's3_ux', title: '사용자 입장에서 불편한 화면과 흐름을 먼저 짚어내요', desc: '어디서 헷갈리는지 빠르게 캐치해 UI와 동작을 개선합니다.', scores: { FE: 3, APP: 3, GAME: 2 }, strength: '사용자 경험(UX) 중심의 빠른 개선 능력' },
            { id: 's3_arch', title: 'API·DB 데이터 흐름을 따라가며 구조적 원인을 정리해요', desc: '요청이 어느 단계에서 꼬였는지 차분히 분리해서 해결합니다.', scores: { BE: 3, ERP: 3, DATA: 2 }, strength: '논리적 백엔드·데이터 흐름 구조화' },
            { id: 's3_metric', title: '로그와 수치를 뽑아 객관적인 근거로 원인을 증명해요', desc: '감으로 추측하기보다 데이터와 실험 결과로 판단합니다.', scores: { DATA: 3, AIML: 3, QA: 2 }, strength: '수치와 로그 기반의 객관적 문제 해결' },
            { id: 's3_sys', title: '실행 환경·네트워크·권한 설정부터 점검해 시스템을 복구해요', desc: '코드 밖의 서버·컨테이너·통신 문제를 안정적으로 잡아냅니다.', scores: { OPS: 3, NET: 3, SEC: 3 }, strength: '시스템·보안·인프라 환경 안정화 역량' },
            { id: 's3_edge', title: '재현 조건을 정리하고 경계값·취약점을 찾아 재발을 막아요', desc: '비슷한 실수가 다시 안 나오도록 기준과 테스트를 세웁니다.', scores: { QA: 3, SEC: 3, ERP: 2 }, strength: '재현 케이스 도출과 품질·보안 기준 수립' }
        ]
    },
    {
        kicker: 'STEP 4 · 현재 고민 & 보완점',
        title: '3-4학년 취업 준비 중 가장 자신 없거나 보완하고 싶은 부분은?',
        subtitle: '현재 약점을 고려해 무리하지 않고 강점을 살릴 수 있는 직무를 우선 추천합니다.',
        maxSelect: 1,
        options: [
            { id: 's4_portfolio', title: '한 분야를 깊게 판 경험이 적어 어디부터 준비할지 막막해요', desc: '레퍼런스와 학습 자료가 풍부하고 입문 진입장벽이 명확한 직무가 좋아요.', scores: { BE: 2, FE: 2, QA: 2 }, weakness: '직무별 핵심 포트폴리오 1개 완성 필요' },
            { id: 's4_algo', title: '고난도 알고리즘·수학·이론 면접이 가장 부담스러워요', desc: '이론 연구보다는 실용적인 구현과 서비스 완성도를 쌓고 싶어요.', scores: { FE: 2, APP: 2, QA: 2, ERP: 2, AIML: -2, IOT: -1 }, weakness: '이론·알고리즘 심화보다 실무 구현 경험 축적 우선' },
            { id: 's4_design', title: '화면 미적 감각은 약하지만 안정적인 기능 구현은 자신 있어요', desc: '보이는 디자인보다 내부 동작과 신뢰성을 다루는 쪽이 편합니다.', scores: { BE: 3, DATA: 2, OPS: 2, ERP: 2, FE: -2 }, weakness: '시각적 디자인 감각 대신 백엔드·데이터 안정성에 강점' },
            { id: 's4_speed', title: '빠른 코딩 속도보다 꼼꼼히 따지고 분석하는 편이에요', desc: '급하게 만들기보다 품질·보안·데이터 정합성을 지키는 게 잘 맞아요.', scores: { QA: 3, SEC: 3, DATA: 2, ERP: 2 }, weakness: '속도 경쟁보다 분석력·정확성을 살리는 포지션 적합' },
            { id: 's4_theory', title: '추상적 설계보다 손에 잡히는 결과물을 직접 만들고 싶어요', desc: '직접 실행하고 조작하면서 배울 때 성장 속도가 빠릅니다.', scores: { FE: 2, APP: 3, GAME: 3, IOT: 3 }, weakness: '추상적 이론보다 프로토타입 제작 중심 학습 추천' }
        ]
    },
    {
        kicker: 'STEP 5 · 희망 결과물',
        title: '졸업 프로젝트나 첫 회사에서 가장 만들고 싶은 결과물은?',
        subtitle: '마지막 질문이에요. 앞으로 포트폴리오로 내세우고 싶은 모습을 골라주세요.',
        maxSelect: 1,
        options: [
            { id: 's5_product', title: '사람들이 매일 손으로 누르고 쓰는 웹·모바일 서비스', desc: '사용자 피드백을 바로 받아 개선하는 프로덕트 개발', scores: { FE: 3, APP: 3, BE: 1 } },
            { id: 's5_backbone', title: '트래픽과 데이터를 안정적으로 처리하는 핵심 서버·업무 시스템', desc: '서비스의 중심을 지탱하는 백엔드/ERP 아키텍처', scores: { BE: 3, ERP: 3, OPS: 1 } },
            { id: 's5_ai', title: '데이터에서 인사이트를 찾거나 똑똑하게 예측하는 AI 기능', desc: '데이터 분석·추천·자동화 모델 파이프라인', scores: { DATA: 3, AIML: 3 } },
            { id: 's5_guard', title: '장애·해킹 없이 안전하게 24시간 돌아가는 클라우드/보안 체계', desc: '인프라 자동화, 네트워크 안정성, 보안 방어 시스템', scores: { OPS: 3, SEC: 3, NET: 3 } },
            { id: 's5_play', title: '생생하게 움직이는 게임 콘텐츠 또는 IoT·임베디드 기기', desc: '실시간 상호작용과 하드웨어 제어의 결합', scores: { GAME: 3, IOT: 3, QA: 1 } }
        ]
    }
];

const PTI_STACK_HINTS = [
    { re: /react|vue|next|typescript|javascript|html|css|tailwind/i, codes: { FE: 2 } },
    { re: /spring|java|node|express|fastapi|django|nest|postgres|mysql/i, codes: { BE: 2, ERP: 1 } },
    { re: /swift|kotlin|flutter|react native|android|ios/i, codes: { APP: 2 } },
    { re: /docker|kubernetes|aws|terraform|ci\/cd|jenkins|github actions|linux/i, codes: { OPS: 2, NET: 1 } },
    { re: /security|owasp|burp|penetration|wireshark/i, codes: { SEC: 2, NET: 1 } },
    { re: /sql|pandas|spark|airflow|tableau|bigquery/i, codes: { DATA: 2 } },
    { re: /pytorch|tensorflow|scikit|ml|ai|llm|opencv/i, codes: { AIML: 2 } },
    { re: /selenium|playwright|cypress|junit|pytest|qa/i, codes: { QA: 2 } },
    { re: /unity|unreal|c#|directx|opengl/i, codes: { GAME: 2 } },
    { re: /c\+\+|embedded|rtos|stm32|arduino|raspberry|firmware/i, codes: { IOT: 2 } },
    { re: /tcp|udp|ccna|cisco|bgp|dns|network/i, codes: { NET: 2 } }
];

let ptiStepIndex = 0;
let ptiAnswers = [];
let ptiRecommended = [];
let ptiApplyCodes = [];

const ptiDialog = () => document.getElementById('preference-ti-dialog');

function availableJobCodeSet() {
    const codes = new Set();
    if (Array.isArray(jobCatalog) && jobCatalog.length) {
        jobCatalog.forEach(row => { if (row?.JOB_CODE) codes.add(row.JOB_CODE); });
    } else {
        document.querySelectorAll('input[name="preferred-job"]').forEach(input => {
            if (input.value) codes.add(input.value);
        });
    }
    return codes;
}

function getPtiJobName(code) {
    const fromCatalog = Array.isArray(jobCatalog) ? jobCatalog.find(item => item.JOB_CODE === code)?.JOB_NAME : null;
    if (fromCatalog) return fromCatalog;
    const fromDom = document.querySelector(`input[name="preferred-job"][value="${code}"]`)?.closest('label')?.querySelector('span')?.childNodes?.[0]?.textContent?.trim();
    return fromDom || PTI_JOB_META[code]?.name || code;
}

function startPreferenceTI() {
    const dlg = ptiDialog();
    if (!dlg || dlg.open) return;
    ptiStepIndex = 0;
    ptiAnswers = PTI_STEPS.map(() => []);
    ptiRecommended = [];
    ptiApplyCodes = [];
    renderPreferenceTIStep();
    dlg.showModal();
    document.getElementById('pti-title')?.focus();
}

function restartPreferenceTI() {
    ptiStepIndex = 0;
    ptiAnswers = PTI_STEPS.map(() => []);
    ptiRecommended = [];
    ptiApplyCodes = [];
    renderPreferenceTIStep();
    document.getElementById('pti-title')?.focus();
}

function renderPreferenceTIStep() {
    const isResult = ptiStepIndex >= PTI_STEPS.length;
    const qView = document.getElementById('pti-question-view');
    const rView = document.getElementById('pti-result-view');
    qView.hidden = isResult;
    rView.hidden = !isResult;

    if (isResult) {
        renderPreferenceTIResult();
        return;
    }

    const step = PTI_STEPS[ptiStepIndex];
    const selected = ptiAnswers[ptiStepIndex] || [];
    document.getElementById('pti-kicker').textContent = `${step.kicker} · ${ptiStepIndex + 1} / ${PTI_STEPS.length}`;
    document.getElementById('pti-title').textContent = step.title;
    document.getElementById('pti-subtitle').textContent = step.subtitle;
    document.getElementById('pti-track-fill').style.width = `${Math.round(((ptiStepIndex + 1) / (PTI_STEPS.length + 1)) * 100)}%`;

    const container = document.getElementById('pti-options');
    container.replaceChildren();
    step.options.forEach(opt => {
        const isSelected = selected.includes(opt.id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pti-option' + (isSelected ? ' is-selected' : '');
        btn.setAttribute('aria-pressed', String(isSelected));

        const copy = document.createElement('div');
        const titleEl = document.createElement('div');
        titleEl.className = 'pti-option-title';
        titleEl.textContent = opt.title;
        const descEl = document.createElement('div');
        descEl.className = 'pti-option-desc';
        descEl.textContent = opt.desc;
        copy.append(titleEl, descEl);

        const mark = document.createElement('span');
        mark.className = 'pti-option-check';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = isSelected ? '✓' : '';

        btn.append(copy, mark);
        btn.addEventListener('click', () => togglePreferenceTIOption(opt.id));
        container.append(btn);
    });

    document.getElementById('pti-error').textContent = '';
    document.getElementById('pti-prev').hidden = ptiStepIndex === 0;
    document.getElementById('pti-next').textContent = ptiStepIndex === PTI_STEPS.length - 1 ? '적합 직무 추천 보기' : '다음 질문';
}

function togglePreferenceTIOption(optionId) {
    const step = PTI_STEPS[ptiStepIndex];
    const current = [...(ptiAnswers[ptiStepIndex] || [])];
    const errEl = document.getElementById('pti-error');
    if (step.maxSelect === 1) {
        ptiAnswers[ptiStepIndex] = [optionId];
        errEl.textContent = '';
    } else if (current.includes(optionId)) {
        ptiAnswers[ptiStepIndex] = current.filter(id => id !== optionId);
        errEl.textContent = '';
    } else {
        const isNeutral = optionId === 's2_none';
        const cleaned = isNeutral ? [] : current.filter(id => id !== 's2_none');
        if (!isNeutral && cleaned.length >= step.maxSelect) {
            errEl.textContent = `이 질문은 최대 ${step.maxSelect}개까지 선택할 수 있습니다.`;
            return;
        }
        ptiAnswers[ptiStepIndex] = [...cleaned, optionId];
        errEl.textContent = '';
    }
    renderPreferenceTIStep();
}

function prevPreferenceTIStep() {
    if (ptiStepIndex > 0) {
        ptiStepIndex -= 1;
        renderPreferenceTIStep();
    }
}

function nextPreferenceTIStep() {
    const selected = ptiAnswers[ptiStepIndex] || [];
    if (!selected.length) {
        document.getElementById('pti-error').textContent = '가장 가까운 항목을 1개 이상 선택해주세요.';
        return;
    }
    ptiStepIndex += 1;
    renderPreferenceTIStep();
}

function computePreferenceTIRecommendation() {
    const allowed = availableJobCodeSet();
    const allCodes = Object.keys(PTI_JOB_META).filter(code => !allowed.size || allowed.has(code));
    const scores = Object.fromEntries(allCodes.map(code => [code, 0]));
    const reasons = Object.fromEntries(allCodes.map(code => [code, []]));
    const strengths = [];
    const weaknesses = [];

    PTI_STEPS.forEach((step, idx) => {
        const chosenIds = ptiAnswers[idx] || [];
        chosenIds.forEach(id => {
            const opt = step.options.find(item => item.id === id);
            if (!opt) return;
            if (opt.strength) strengths.push(opt.strength);
            if (opt.weakness) weaknesses.push(opt.weakness);
            Object.entries(opt.scores || {}).forEach(([code, delta]) => {
                if (!(code in scores)) return;
                scores[code] += delta;
                if (delta >= 2) reasons[code].push(opt.title);
            });
        });
    });

    const currentStack = document.getElementById('input-stack')?.value || '';
    if (currentStack.trim()) {
        PTI_STACK_HINTS.forEach(rule => {
            if (rule.re.test(currentStack)) {
                Object.entries(rule.codes).forEach(([code, boost]) => {
                    if (code in scores) scores[code] += boost * 0.5;
                });
            }
        });
    }

    const ranked = allCodes
        .map(code => ({ code, score: scores[code], matched: reasons[code] }))
        .sort((a, b) => b.score - a.score || allCodes.indexOf(a.code) - allCodes.indexOf(b.code));

    const top3 = ranked.slice(0, 3).map((entry, idx) => {
        const meta = PTI_JOB_META[entry.code] || { name: entry.code, summary: '' };
        const basis = entry.matched.length
            ? `선택하신 '${entry.matched[0]}' 성향과 잘 맞습니다. ${meta.summary}`
            : meta.summary;
        return { rank: idx + 1, code: entry.code, name: getPtiJobName(entry.code), reason: basis };
    });

    return {
        strengthsText: strengths.length ? strengths.slice(0, 2).join(' · ') : '다양한 기술 영역을 고르게 탐색할 수 있는 유연한 성향',
        weaknessesText: weaknesses.length ? weaknesses.slice(0, 2).join(' · ') : '기초 구현 역량을 바탕으로 한 실무 포트폴리오 확장이 핵심입니다.',
        top3
    };
}

function renderPreferenceTIResult() {
    const diagnosis = computePreferenceTIRecommendation();
    ptiRecommended = diagnosis.top3;
    ptiApplyCodes = ptiRecommended.map(item => item.code);

    document.getElementById('pti-kicker').textContent = '선호직무TI · 분석 결과';
    document.getElementById('pti-title').textContent = `가장 잘 맞는 직무는 ${ptiRecommended[0]?.name || '추천 직무'}입니다`;
    document.getElementById('pti-subtitle').textContent = '응답한 강점과 부담 요소를 종합해 1~3순위 추천 직무를 정리했습니다.';
    document.getElementById('pti-track-fill').style.width = '100%';
    document.getElementById('pti-strength-summary').textContent = diagnosis.strengthsText;
    document.getElementById('pti-weakness-summary').textContent = diagnosis.weaknessesText;

    renderPreferenceTIRecCards();
}

function renderPreferenceTIRecCards() {
    const list = document.getElementById('pti-rec-list');
    list.replaceChildren();
    ptiRecommended.forEach(item => {
        const applyOrder = ptiApplyCodes.indexOf(item.code);
        const isSelected = applyOrder !== -1;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'pti-rec-card' + (isSelected ? ' is-selected' : '');
        card.setAttribute('aria-pressed', String(isSelected));

        const copy = document.createElement('div');
        const meta = document.createElement('div');
        meta.className = 'pti-rec-meta';
        meta.textContent = isSelected
            ? `0${applyOrder + 1} · 적용 예정 ${applyOrder + 1}순위`
            : `추천 ${item.rank}순위 · 제외됨`;

        const name = document.createElement('div');
        name.className = 'pti-rec-name';
        name.textContent = item.name;

        const reason = document.createElement('div');
        reason.className = 'pti-rec-reason';
        reason.textContent = item.reason;

        copy.append(meta, name, reason);

        const mark = document.createElement('span');
        mark.className = 'pti-option-check';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = isSelected ? '✓' : '';

        card.append(copy, mark);
        card.addEventListener('click', () => {
            const errEl = document.getElementById('pti-result-error');
            if (ptiApplyCodes.includes(item.code)) {
                ptiApplyCodes = ptiApplyCodes.filter(c => c !== item.code);
                errEl.textContent = '';
            } else if (ptiApplyCodes.length >= 3) {
                errEl.textContent = '선호 직무는 최대 3개까지 적용할 수 있습니다.';
                return;
            } else {
                ptiApplyCodes.push(item.code);
                errEl.textContent = '';
            }
            renderPreferenceTIRecCards();
        });
        list.append(card);
    });

    const names = ptiApplyCodes.map((code, i) => `${i + 1}순위 ${getPtiJobName(code)}`).join(' · ');
    document.getElementById('pti-apply-note').textContent = ptiApplyCodes.length
        ? `창을 닫으면 아래 선호 직무에 자동 체크됩니다: ${names}`
        : '적용할 직무를 1개 이상 선택하거나, 적용 없이 닫기를 눌러주세요.';
    document.getElementById('pti-apply-close').disabled = !ptiApplyCodes.length;
}

function closePreferenceTI(applySelection) {
    const dlg = ptiDialog();
    if (applySelection && ptiApplyCodes.length) {
        const allowed = availableJobCodeSet();
        const valid = ptiApplyCodes.filter(code => !allowed.size || allowed.has(code)).slice(0, 3);
        if (valid.length) {
            preferredJobCodes = [...valid];
            syncPreferredJobRanks();
            const appliedNames = valid.map((code, i) => `${i + 1}순위 ${getPtiJobName(code)}`).join(', ');
            showToast(`추천 선호 직무가 체크되었습니다 (${appliedNames}). 저장하기를 눌러 반영하세요.`);
            if (myPageReady) myPageStatus('추천된 선호 직무가 선택되었습니다. 저장하기를 눌러 DB에 저장하세요.');
        }
    }
    if (dlg?.open) dlg.close();
    if (applySelection) {
        document.getElementById('job-preference-options')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}
