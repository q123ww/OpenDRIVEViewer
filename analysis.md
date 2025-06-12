# OpenDRIVE Viewer 개선을 위한 `Danaozhong/odrviewer` 분석 결과 (중간 요약)
> 📋 **실행 가능한 할 일 목록**: [_TASK_LIST.md](./_TASK_LIST.md)에서 확인할 수 있습니다.
> 이 파일은 ‘왜 / 어떻게 할 것인가(분석, 결정 근거, 기술 메모)’를 다룹니다.

## Phase 1: 코드 구조 분석 및 핵심 지오메트리 처리 로직 파악 (완료)
*이 단계의 분석 결과는 아래 각 절에 요약되어 있으며, `Danaozhong/odrviewer` Python 코드의 주요 로직을 이해하는 데 중점을 두었습니다.*

### 1.1. `Danaozhong/odrviewer` 저장소 분석 준비 (완료)
- 프로젝트 목적 및 주요 기술 스택 파악 완료.
- 주요 디렉토리 및 파일 역할 정리 완료.
- 예상 데이터 처리 흐름 정의 완료.

### 1.2. OpenDRIVE 데이터 파싱 및 객체 모델링 분석 (완료)
- `pyxodr` 라이브러리 기반 Python 객체 모델링 방식 분석 완료.
- JavaScript DOMParser 방식과 비교하여 장단점 논의 완료.
- JavaScript에서도 구조화된 객체 모델 도입의 필요성 확인 (이는 Phase 2.6에서 실제로 구현됨).

### 1.3. 핵심 지오메트리 계산 로직 분석 (`geometry.py` 등) (완료)
- **Line, Arc**: Python 코드의 로직 분석 및 현재 JavaScript 로직과의 비교 완료. 큰 개선점은 초기에는 발견되지 않았으나, 정점 생성 간격 등은 추후 조정됨.
- **Spiral**: Python 코드의 프레넬/수치 적분 사용 가능성 분석 완료. JavaScript 구현 시 고려사항 정리 (Simpson's rule을 사용한 수치 적분으로 JS에 구현 - Phase 2.3에서 완료).
- **Poly3/ParamPoly3**: Python 코드의 로직 분석 완료. JavaScript 구현 시 핵심 단계 정리 (JS에 구현 - Phase 2.4에서 완료).

### 1.4. 차선(Lane) 생성 및 오프셋/폭 처리 로직 분석 (완료)
- Python 코드에서의 차선 데이터 구조 및 계산 과정 분석 완료.
- JavaScript `OpenDriveViewer.js` (현재는 `GeometryBuilder.js`)에 적용할 방안 아이디어 도출 완료 (Phase 2.5 진행 중).

### 1.5. QGIS 연동 및 시각화 로직 분석 (개념적 이해 완료)
- QGIS 플러그인의 데이터 처리 및 시각화 방식 요약 완료.
- WebGL 기반 뷰어에 참고할 만한 시각화/인터랙션 아이디어 도출 완료.

### 1.6. 좌표계 변환 로직 분석 (완료)
- `Danaozhong/odrviewer`와 `OpenDriveViewer.js`의 좌표 변환 방식 비교 분석 완료.
- 현재 `OpenDriveViewer.js`의 `odToWorld` 함수 및 헤딩 처리 방식 유지 결정.

## Phase 2: JavaScript 코드 개선 및 기능 구현 (진행 중)

### 2.1. `OpenDriveViewer.js` 구조 개선 및 모듈화 (완료)
- **진행 상황**: 제안된 모듈(`OpenDriveParser.js`, `GeometryBuilder.js`, `SceneManager.js`, `UIManager.js`, `OpenDriveViewer.js` (메인 컨트롤러), `DebugLogger.js`)로 성공적으로 분리 완료.
- `index.html` 수정하여 모듈 로드 및 `importmap` 사용, ES6 모듈 표준 준수.
- 모듈화 초기 발생했던 다양한 로딩 문제 및 실행 오류 해결 (상세 내용은 `analysis.md`의 이전 버전 또는 `_TASK_LIST.md`의 디버깅 기록 참고).
- `GeometryBuilder.js`의 `createRoadSegmentMesh` 함수 내 정점 생성 간격을 조절하여 (초기 10cm -> 이후 성능 테스트를 위해 1m로 변경) 라인 표현 정밀도와 성능 간의 트레이드오프 진행 중.

### 2.2. 기본 지오메트리 (Line, Arc) 렌더링 정확도 향상 (진행 중)
- **진행 상황**: 현재 `GeometryBuilder.js` 내 로직이 `Danaozhong/odrviewer`와 비교하여 큰 부정확성은 없는 것으로 판단. 주로 `pointInterval` 값 조정을 통해 성능과 시각적 품질을 조율 중. 초기에는 정밀도 향상을 위해 간격을 줄였으나, 현재는 성능 문제로 인해 간격을 다시 늘린 상태. Python 코드의 특정 알고리즘을 직접적으로 가져와 개선하기보다는, 전반적인 파이프라인 최적화에 집중.

### 2.3. 고급 지오메트리 (Spiral) 렌더링 기능 추가 (완료)
- **진행 상황**: `GeometryBuilder.js`에 Simpson's rule 기반 수치 적분 함수(`_simpson`) 및 이를 활용한 Spiral 지오메트리 계산 로직 구현 완료. Spiral 세그먼트는 파란색으로 렌더링되어 식별 가능.

### 2.4. 고급 지오메트리 (Poly3/ParamPoly3) 렌더링 기능 추가 (완료)
- **진행 상황**: `GeometryBuilder.js`에 Poly3 및 ParamPoly3 지오메트리 계산 로직 구현 완료. 각 세그먼트는 Poly3의 경우 녹색, ParamPoly3의 경우 보라색으로 렌더링되어 식별 가능. `pRange` 속성 처리 포함.

### 2.5. 차선(Lane) 렌더링 로직 활성화 및 개선 (진행 중)
- **진행 상황**: `GeometryBuilder.js`에 `buildLaneGeometries` 함수 및 관련 헬퍼 함수(`_getLaneOffsetAtS`, `_getLaneWidthAtS`) 구현. 도로 참조점을 기반으로 각 차선의 좌우 경계선을 계산하여 `THREE.Line`으로 렌더링하는 초기 로직 완성.
- **디버깅**: 차선이 그려지지 않거나, 특정 차선(예: 중앙선)만 누락되는 등의 문제 발생. `console.log`를 활용한 상세 디버깅을 통해 `laneWidth` 계산, `tOffsetRef` 적용, 좌표 변환 등의 로직을 단계별로 수정하고 검증함. `THREE.LineBasicMateria` 오타 수정. 모든 도로에 대해 차선 그리도록 `OpenDriveViewer.js` 수정 완료. 현재는 차선이 정상적으로 렌더링 되고 있음.

### 2.6. XML 파싱 및 데이터 중간 객체 구조 개선 (완료)
- **진행 상황**: `OpenDriveParser.js`가 XML DOM을 직접 순회하는 대신, OpenDRIVE 주요 요소들을 표현하는 구조화된 JavaScript 객체 모델(Header, Road, PlanView, Geometry 타입들, Lanes, LaneSection, Lane, LaneWidth, LaneOffset 등)을 반환하도록 성공적으로 리팩토링 완료. 이는 데이터 접근의 명확성과 코드 유지보수성을 향상시킴.

## Phase 3: 테스트, 디버깅 및 추가 기능 고려 (진행 중)

### 3.1. 종합 테스트 및 디버깅 (진행 중)
- **진행 상황**: 모듈화, 각 지오메트리 타입 구현, 차선 렌더링 과정에서 지속적인 테스트 및 디버깅 수행.
    - **주요 해결 문제**: 모듈 로딩 오류, `THREE` 객체 정의 오류, `getContext` 오류, UI 연동 오류, 차선 생성 로직 오류 등 다수.
    - **UI 상호작용 디버깅**: 
        - 기존 렌더링 옵션 제어용 체크박스들(참조선, 차선 토글 등)의 기능 및 `SceneManager` 연동은 정상화되었습니다.
        - 최근 UI 레이아웃 변경 요청(2024-07-17)에 따라 "Display Options" 섹션이 제거되고, "Roads" 토글은 삭제되었으며, "Grid" 토글은 "Lane Types" 섹션으로 이동했습니다. 이와 관련된 HTML, UIManager, OpenDriveViewer 스크립트 수정이 이루어졌습니다.
    - **현재 디버깅 이슈 (2024-07-17 PAUSED)**: 위 UI 변경 후 "Lane Types" (referenceLine, driving, sidewalk) 체크박스에 대한 `change` 이벤트가 발생하지 않는 문제 확인. `UIManager.js`의 `initLaneTypeCheckboxes`에서 이벤트 리스너 자체는 성공적으로 등록되는 것으로 로그상 확인되나, 실제 이벤트 콜백 함수가 트리거되지 않아 해당 차선 유형들의 가시성 토글 기능이 작동하지 않음. (상세 디버깅 내용은 `UIManager.js` 내 주석 참고) 
    - **현재 상태**: 주요 기능은 동작하나, 대용량 파일(`Germany_2018.xodr`) 로드 시 심각한 성능 저하 문제 발생.
    - **UI 상호작용**: 도로 목록 표시 및 선택 시 포커싱 기능, 마우스 오버 시 도로/차선 정보 툴팁 표시 기능 구현 완료.
    - **폭 계산 오류 수정 (2025-06-12)**: 대용량 XODR 파일(`Germany_2018.xodr`) 테스트 중 `GeometryBuilder.js`의 `getLaneWidthAt`에서 누적 폭이 비정상적으로 커져 콘솔에 `Abnormal width` 경고가 대량 발생하고 도로 표면 메시가 왜곡되는 문제를 발견.  
        - **원인**: (1) 폭 세그먼트가 존재하지 않는 차로에 대해 기본 폭 3.5 m를 적용하여 실제로 존재하지 않는 차로 폭이 누적됨. (2) 폭 다항식이 유효 범위를 벗어날 때 100 m 이상 값이 반환되는 경우가 있었음.  
        - **조치**: ① 폭 세그먼트가 비어있을 때 기본 값을 0 m로 변경. ② 단일 차로 폭이 20 m를 초과하면 `warn` 로그를 남기고 20 m로 클램핑하는 가드 레일 도입.  
        - **결과**: Road 29, 121 등에서 발생하던 `Abnormal width` 로그가 사라졌으며, 곡선·가변폭 구간의 표면 및 차선 메시 위치가 정상화됨.

### 3.2. UI/UX 개선 (부분 진행)
- **진행 상황**: 
    - 기본적인 파일 로드 UI, 디버그 패널, 로딩 인디케이터, 도로 목록 및 포커스 기능, 마우스 오버 툴팁 기능 구현 완료.
    - **렌더링 옵션 제어 UI 변경 (2024-07-17)**: "Display Options" UI 섹션이 사용자의 요청에 따라 제거되었습니다. "Roads" 토글은 삭제되었고, "Grid" 토글은 "Lane Types" 섹션 하위로 이동했습니다. 이에 따라 `index.html`의 구조와 `UIManager.js` 및 `OpenDriveViewer.js`의 관련 로직이 수정되었습니다.
    - "Lane Types" 섹션의 체크박스(Reference Line, Driving, Sidewalk) 및 이동된 "Grid" 체크박스는 UI상으로는 배치되었으나, "Lane Types" 체크박스의 이벤트 핸들링 문제(상단 3.1절 디버깅 이슈 참고)로 인해 해당 가시성 토글 기능이 현재 완전히 동작하지 않는 상태입니다. "Grid" 토글 기능은 Lane Types 문제 해결 후 최종 확인 필요.
    - `odrviewer.io` 수준의 고급 UI/UX는 아직 미흡.

### 3.3. 미지원 주요 OpenDRIVE 요소 처리 방안 논의 및 기초 조사 (계획)
- Junction, ElevationProfile 등의 처리는 아직 시작되지 않음.

### 3.4. 성능 최적화 검토 및 구현 (현재 주요 과제)
- **문제 상황**: `Germany_2018.xodr` 파일 로드 시 약 1분 이상 소요되어 사용성 저해 및 렌더링 중 심각한 FPS 저하 (1 FPS까지 하락) 발생.
- **1차 시도 결과**: `GeometryBuilder.js`의 `pointInterval` 및 `_simpson` 함수의 `n` 값 조정, `UIManager.js`의 도로 목록 업데이트 빈도 조절 등을 통해 약간의 개선은 있었으나, 여전히 목표 FPS(최소 30)에 크게 미달.
- **수립된 종합 성능 개선 전략 (목표: 최소 30 FPS 확보)**:
    1.  **최우선: 특정 도로 로드 실패 문제 해결**: Worker의 초기 파싱 정확도 확보 및 메인 스레드의 상세 파싱/지오메트리 생성 안정화.
    2.  **1단계: 렌더링 요소의 선택적 표시 및 지연 로딩**: 참조선 기본 숨김 및 UI 토글로 제어하여 초기 렌더링 부하 즉시 감소.
    3.  **2단계: 순차 로딩 시 시간 분할 강화**: `loadRemainingRoadsSequentially` 내부 작업 세분화 및 `setTimeout` 활용으로 로딩 중 UI 반응성 개선.
    4.  **3단계: LOD (Level of Detail) - `pointInterval` 동적 조절**: 카메라 거리/도로 복잡도에 따른 정점 수 동적 조절로 렌더링 최적화.
    5.  **4단계: Web Worker 활용 확대 (상세 정보 처리 지원 및 지오메트리 계산)**: (고급 최적화) 필요시, `parseRoadDetails`의 일부 문자열 기반 상세 정보 추출 또는 `GeometryBuilder`의 복잡한 계산(Spiral 등)을 Worker로 이전하여 메인 스레드 부담 경감. 초기 파싱(`parseInitial`)은 Worker에서 안정적으로 수행함을 전제.
    6.  **추가 고려 (선택적/장기 과제)**: 지오메트리 병합, 영역 선택(바운딩 박스) 기반 로딩.
- **기대 효과**: 위 단계별 최적화를 통해 초기 로딩 시간 단축, 렌더링 FPS 향상, 전반적인 사용자 경험 개선. 특히 Web Worker의 점진적 역할 확대는 장기적으로 복잡한 연산 처리의 핵심이 될 것임.

### 3.4.1. Web Worker 도입을 통한 파싱 성능 개선 (1단계: `parseInitial`)
- **목표**: `OpenDriveParser.js`의 `parseInitial`

## Phase 4: C++ 파서 WASM 전환 실험 (진행 중)

### 4.1 설계 (완료)
- JS 파서를 완전히 대체할 솔루션으로 **WASM(WebAssembly) 방식**을 1순위로 결정.
- 서버/REST 방식은 대용량·서버 통제가 필요한 조직 환경에서만 보조 전략으로 채택.

### 4.2 1차 WASM 빌드·통합 (2025-06-12)
1. **Emscripten SDK** 설치 및 환경 변수 설정 절차 문서화.
2. `build_wasm.sh` 작성   
   - `libOpenDRIVE-main` 소스 + `pugixml` + 스텁 `wasm_parser_wrapper.cpp` 컴파일   
   - `-s MODULARIZE=1 -s EXPORT_ES6=1` → ES6 default export 제공.
3. 빌드 성공 → `OpenDriveWasm.js / .wasm` 산출.
4. **OpenDriveViewer.js** 수정   
   - Worker 파서 삭제, `import OpenDriveWasmModule from './OpenDriveWasm.js'` 로드   
   - `parseXodr`(스텁) 호출 → JSON 길이 반환, 콘솔 확인.
5. **index.html**   
   - 불필요한 `OpenDriveParser` 전역 제거, 오류(`ReferenceError`) 해결.

> ✅ 브라우저 콘솔 `WASM module ready` 메시지 확인으로 로드 완료.

### 향후 작업
- `wasm_parser_wrapper.cpp` 를 실제 **`odr::OpenDriveMap` + `nlohmann::json`** 직렬화로 교체.
- JSON 스키마 설계 → Three.js 파이프라인 연결 (`SceneManager.loadOpenDrive`).
- 성능·메모리 측정, 파서 최적화(O2, threading?)

## 4.2.1 2025-06-12 진행 내역 요약
오늘은 WASM 파서 스텁(`pugixml`)의 JSON 누락 따옴표 오류를 해결했으나,
스텁 구조 한계(지오메트리·차선 정보 부족)로 **libOpenDRIVE `OpenDriveMap` 기반 파서**를 도입하기로 회귀 결정하였습니다.

### 결정 사항
1. **MEMFS + OpenDriveMap** 방식 채택
   - 입력 XODR 문자열을 `/tmp/xodr_*.xodr` 로 저장 후 `odr::OpenDriveMap` 생성자 호출.
   - nlohmann::json 으로 JS 친화 경량 스키마 직렬화.
2. **WASM 래퍼 설계**
   - `writeMemFile`, `mapRoad()`, `parseOpenDrive()` 함수로 SRP 분리.
   - `parseOpenDrive` → JSON 문자열 반환, JS 에서 `JSON.parse()` 로 사용.
3. **빌드 플래그**
   - `-s USE_STD_FILESYSTEM=1` 로 `std::ofstream` 사용.
   - `ALLOW_MEMORY_GROWTH`, `MODULARIZE`, `EXPORT_ES6` 유지.

## 내일(2025-06-13) 작업 계획
1. **저장소 준비**
   - libOpenDRIVE 서브모듈 init & 업데이트.
   - nlohmann/json 헤더 추가.
2. **WASM 래퍼 구현**
   - `src/opendrive_wasm.cpp` 작성 및 바인딩.
3. **빌드 스크립트 수정** (`build_wasm.sh`)
   - 필요 소스·플래그 반영, 불필요 소스 제외.
4. **JavaScript 통합**
   - `OpenDriveViewer.js` 에서 `parseOpenDrive` 호출.
   - `SceneManager` 새 JSON 스키마 매핑 함수 작성.
5. **테스트 & 검증**
   - `Crossing8Course.xodr` 로드 → 도로 수, 길이, 차선, refLine 데이터 확인.
6. **문서 업데이트**
   - README 빌드 지침에 emsdk, 서브모듈, 빌드 방법 명시.

> 커서 룰 – SRP, 테스트 용이성, 독립적 배포 가능성, 가독성 원칙을 준수하여 단계별 작업을 진행합니다.

---