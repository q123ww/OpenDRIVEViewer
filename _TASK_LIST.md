# OpenDRIVE Web Viewer 개선 작업 목록 (Danaozhong/odrviewer 참조)
> 📑 **관련 문서**: 프로젝트 결정 근거와 상세 분석은 [analysis.md](analysis.md) 를 참고하세요.
> 이 파일은 '무엇을 할 것인가(TODO / 일정 / 체크리스트)'를 집중적으로 다룹니다.

- 작업경로 : /Hexagon/OpenDRIVEViewer

## Phase 1: 코드 구조 분석 및 핵심 지오메트리 처리 로직 파악 (Python 코드 이해 단계)
*이 단계의 상세 분석 결과는 `analysis.md` 파일에 기록되어 있습니다.*

### 1.1. `Danaozhong/odrviewer` 저장소 분석 준비
- **프롬프트**: `Danaozhong/odrviewer` GitHub 저장소 (https://github.com/Danaozhong/odrviewer)를 로컬에 클론하고, 프로젝트의 전체 디렉토리 구조를 파악하여 각 주요 폴더(예: `converter`, `model`, `pyxodr`, `geometry`)의 역할과 핵심 Python 파일들을 식별해 주세요. README 및 관련 문서를 통해 프로젝트의 목적과 기본적인 데이터 처리 흐름을 요약해 주세요.
- **예상 결과물**: 프로젝트 구조 요약, 주요 모듈 기능 정리 문서 또는 마인드맵. (완료, `analysis.md` 참고)

### 1.2. OpenDRIVE 데이터 파싱 및 객체 모델링 분석
- **프롬프트**: `Danaozhong/odrviewer`에서 XODR 파일이 로드될 때, 어떤 과정을 거쳐 Python 객체로 변환되는지 분석해 주세요. 특히 `model` 디렉토리와 `pyxodr` 라이브러리가 OpenDRIVE의 주요 요소(Road, PlanView, Geometry, LaneSection, Lane 등)를 어떻게 클래스로 정의하고 속성을 파싱하여 저장하는지 상세히 설명해 주세요. 현재 우리 `OpenDriveViewer.js`의 DOMParser 기반 직접 파싱 방식과 비교하여 장단점을 간략히 논의해 주세요.
- **예상 결과물**: Python 객체 모델링 방식 분석 보고서, `OpenDriveViewer.js` 파싱 방식과의 비교. (완료, `analysis.md` 참고)

### 1.3. 핵심 지오메트리 계산 로직 분석 (`geometry.py` 등)
- **프롬프트 (Line & Arc)**: `Danaozhong/odrviewer`의 `geometry.py` (또는 관련 모듈)에서 `Line` (직선)과 `Arc` (원호) 지오메트리를 처리하는 Python 클래스 또는 함수를 찾아, 입력 파라미터(s, x, y, hdg, length, curvature 등)를 기반으로 참조선 상의 정점 좌표들을 계산하는 알고리즘을 상세히 분석해 주세요. 현재 `OpenDriveViewer.js`의 `createRoadSegmentMesh` 내 해당 로직과 비교하여, 좌표계 변환, 파라미터 해석, 계산 정밀도 등에서 주요 차이점이나 개선점을 식별해 주세요.
- **프롬프트 (Spiral)**: `Danaozhong/odrviewer`에서 `Spiral` (나선형/클로소이드) 지오메트리를 처리하는 부분을 찾아, 입력 파라미터(예: `curvStart`, `curvEnd`, `length`, `s`)를 사용하여 곡선 상의 정점들을 계산하는 수학적 공식 또는 접근 방식을 파악해 주세요. (예: `scipy.integrate` 사용 여부, 프레넬 적분(Fresnel integrals) 사용 여부 등). 이 로직을 JavaScript로 변환하기 위한 주요 단계와 고려사항을 정리해 주세요.
- **프롬프트 (Poly3/ParamPoly3)**: `Danaozhong/odrviewer`에서 `Poly3` (3차 다항식) 및 `ParamPoly3` (매개변수형 3차 다항식, u,v 좌표 사용) 지오메트리를 처리하는 로직을 분석해 주세요. 다항식 계수(a, b, c, d)와 s(또는 u)값을 사용하여 지역 좌표(u,v)를 계산하고, 이를 다시 도로 참조선 좌표로 변환하는 과정을 상세히 설명해 주세요. 이 로직을 JavaScript로 구현하기 위한 핵심 단계를 정리해 주세요.
- **예상 결과물**: 각 지오메트리(Line, Arc, Spiral, Poly3, ParamPoly3) 처리 방식 분석, JS 변환 시 고려사항. (완료, `analysis.md` 참고)

### 1.4. 차선(Lane) 생성 및 오프셋/폭 처리 로직 분석
- **프롬프트**: `Danaozhong/odrviewer`에서 도로 참조선을 기준으로 차선 경계가 계산되는 과정을 분석해 주세요. 특히, `<laneOffset>` 레코드의 다항식 계수(a,b,c,d)가 도로 참조선의 횡방향 오프셋에 어떻게 적용되는지, 그리고 각 `<lane>`의 `<width>` 레코드에 정의된 sOffset 및 다항식 계수(a,b,c,d)가 해당 차선의 폭을 계산하는 데 어떻게 사용되는지 상세히 설명해 주세요. 이 로직들이 `OpenDriveViewer.js`의 차선 생성 로직(현재 주석 처리)에 어떻게 적용될 수 있을지 아이디어를 제시해 주세요.
- **예상 결과물**: 차선 오프셋 및 폭 계산 로직 분석, `OpenDriveViewer.js` 적용 방안. (완료, `analysis.md` 참고)

### 1.5. QGIS 연동 및 시각화 로직 분석 (개념적 이해)
- **프롬프트**: `Danaozhong/odrviewer`가 계산된 지오메트리(도로, 차선 등)를 QGIS에 어떻게 표시하는지, 예를 들어 어떤 QGIS API를 사용하고, 스타일링(`.qml` 파일)은 어떻게 적용되는지 간략하게 설명해 주세요. 이 부분은 WebGL 기반인 `OpenDriveViewer.js`와 직접적인 코드 변환은 어렵겠지만, 시각화 아이디어나 사용자 인터랙션 측면에서 참고할 만한 부분이 있는지 파악해 주세요.
- **예상 결과물**: QGIS 연동 방식 요약, 시각화/인터랙션 아이디어. (완료, `analysis.md` 참고)

### 1.6. 좌표계 변환 로직 분석 (추가 분석 필요)
- [x] **프롬프트**: `Danaozhong/odrviewer` 내에서 OpenDRIVE 좌표계(X-전방, Y-좌측, Z-상, 헤딩-반시계방향)의 데이터를 QGIS 또는 내부 시각화 엔진이 사용하는 좌표계로 변환하는 부분을 찾아, 구체적인 변환 규칙(예: 축 매핑, 스케일, 회전 방향)을 파악해 주세요. 현재 `OpenDriveViewer.js`의 `odToWorld` 함수와 비교하여 일치점과 차이점을 분석하고, 필요한 경우 `odToWorld` 함수의 개선안을 제시해 주세요.
- **예상 결과물**: Python 프로젝트의 좌표계 변환 로직 분석, `odToWorld` 함수 개선 제안. (완료, `analysis.md` 1.6절 참고 - 현재 방식 유지 결론)

---

## Phase 2: JavaScript 코드 개선 및 기능 구현 (Three.js 기반 뷰어 개발 단계)

**목표**: Phase 1 분석 결과를 바탕으로 `OpenDriveViewer.js`의 지오메트리 및 차선 렌더링 로직을 개선하고, 미지원 기능을 추가하여 웹 뷰어의 완성도 향상.

### 2.1. `OpenDriveViewer.js` 구조 개선 및 모듈화 준비
- **프롬프트**: 현재 `OpenDriveViewer.js` 파일은 모든 기능이 하나의 클래스에 집중되어 있습니다. 가독성과 유지보수성 향상을 위해 기능을 모듈화하는 방안을 구상해 주세요. 예를 들어, 파싱, 지오메트리 계산, 렌더링, UI 제어 등을 별도의 모듈/클래스로 분리하는 아이디어를 제시하고, 각 모듈의 예상 역할과 인터페이스(주요 함수)를 간략히 설명해 주세요. (실제 파일 분리는 추후 단계에서 진행)
- **진행 상황**:
    - 제안된 모듈(`OpenDriveParser.js`, `GeometryBuilder.js`, `SceneManager.js`, `UIManager.js`, `OpenDriveViewer.js` (메인 컨트롤러), `DebugLogger.js`)로 분리 완료.
    - `index.html` 수정하여 모듈 로드.
    - 모듈화 이후 발생한 "맵 데이터 안 뜬다" 문제는 `UIManager.js`의 파일 입력 이벤트 처리 로직 수정으로 해결.
    - "도로 라인 잘 연결 안 되는 부분" 해결을 위해 `GeometryBuilder.js`의 `createRoadSegmentMesh` 함수 내 정점 생성 간격을 10cm당 1점으로 조밀화.
- **예상 결과물**: `OpenDriveViewer.js` 리팩토링 방안 (모듈 구성, 역할, 주요 함수 인터페이스). 구체적인 제안은 다음과 같습니다:
    - **제안 모듈 구성**:
        1.  **`OpenDriveParser.js`**: XODR 파일(XML 문자열 또는 DOM)을 입력받아, OpenDRIVE 사양에 맞는 JavaScript 객체 트리로 변환합니다. Phase 1.2에서 논의된 것처럼, `pyxodr`와 유사하게 각 OpenDRIVE 요소를 표현하는 클래스/객체 구조를 가질 수 있습니다 (예: `Road`, `LaneSection`, `Geometry` 등).
            - 주요 함수/인터페이스: `parse(xmlStringOrDom)` (최상위 OpenDRIVE 객체 반환).
        2.  **`GeometryBuilder.js` (또는 `RoadGeometry.js`)**: 파싱된 OpenDRIVE 객체(`OpenDriveData`)를 입력받아, 3D 시각화를 위한 지오메트리 데이터(정점, 인덱스 등)를 생성합니다. Line, Arc, Spiral, Poly3 등의 계산 로직이 여기에 포함됩니다. 또한, 차선 경계 계산 로직도 이 모듈의 일부가 될 수 있습니다.
            - 주요 함수/인터페이스: `buildRoadGeometry(roadElement)`, `buildLaneGeometry(roadElement, laneElement)`, `calculateSpiralPoints(params)`, `calculateArcPoints(params)`, `getLaneOffsetsAndWidths(s, roadElement, laneSectionElement)`.
        3.  **`SceneManager.js` (또는 `Viewer.js`)**: Three.js 씬(scene) 설정을 담당하고, `GeometryBuilder`로부터 받은 지오메트리 데이터를 Three.js 메쉬(`THREE.Mesh`, `THREE.Line`)로 변환하여 씬에 추가/제거합니다. 카메라, 조명, 그리드, 컨트롤(OrbitControls) 등의 초기화 및 관리를 담당합니다.
            - 주요 함수/인터페이스: `constructor(canvasElement)`, `loadOpenDrive(openDriveData)`, `clearScene()`, `addMeshToScene(mesh)`, `removeMeshFromScene(mesh)`, `focusOnRoad(roadId)`, `setGridVisible(visible)`, `render()`.
        4.  **`UIManager.js`**: HTML UI 요소(파일 입력, 디버그 패널, 도로 목록, 레이어 컨트롤 등)의 이벤트 처리 및 DOM 조작을 담당합니다. `SceneManager`나 다른 모듈과 상호작용하여 뷰어의 상태를 변경하거나 정보를 표시합니다.
            - 주요 함수/인터페이스: `initUI(callbacks)`, `showLoading(visible)`, `showError(message)`, `updateDebugPanel(logMessage)`, `populateRoadList(roadIds)`.
        5.  **`OpenDriveViewer.js` (메인 컨트롤러)**: 위 모듈들을 초기화하고, 전체 애플리케이션의 흐름을 제어합니다. UI 이벤트에 따라 적절한 모듈의 함수를 호출하고, 데이터 전달을 중개합니다.
            - 주요 함수/인터페이스: `constructor(canvasId, uiElements)`, `loadFile(file)`, `init()`.
        6.  **`DebugLogger.js`**: 기존과 같이 디버그 메시지를 UI 패널 및 콘솔에 로깅합니다. 다른 모듈에서 직접 사용될 수 있습니다.
            - 주요 함수/인터페이스: `log(message)`, `error(message)`, `warn(message)`.
    - **기대 효과**: 책임 분리, 코드 재사용성 증대, 유지보수 용이성 향상.
    - (이 내용은 `analysis.md`에도 반영되어 있으며, Phase 2의 첫 번째 구체적인 작업으로 간주)

### 2.2. 기본 지오메트리 (Line, Arc) 렌더링 정확도 향상
- [ ] **프롬프트**: Phase 1.3 분석 결과를 바탕으로, `OpenDriveViewer.js`의 `createRoadSegmentMesh` 함수 내 직선(Line) 및 원호(Arc) 지오메트리 참조선 생성 로직을 수정/개선해 주세요. Python 코드의 계산 방식 중 정확도나 효율성 면에서 우수하다고 판단되는 부분을 JavaScript로 적용하고, 테스트 XODR 파일(예: `Germany_2018.xodr` 또는 단순 테스트 케이스)을 사용하여 수정 전후 렌더링 결과를 비교하고 검증 결과를 로그 및 스크린샷으로 보고해 주세요.
    - **수정 대상**: `GeometryBuilder.js`의 `createRoadSegmentMesh` 함수.
    - **참고 자료**: Phase 1.3 분석 결과.
    - **검증 방법**: 다양한 XODR 파일 로드 후 직선/원호 부분 시각적 확인, 주요 좌표값 로그 비교.
    - **진행 상황**: 현재 로직이 합리적으로 판단되며, `Danaozhong/odrviewer` 대비 명확한 개선점 도출에 어려움이 있어 사용자 의견 대기 중. 정점 생성 간격은 2.1에서 조밀화.

### 2.3. 고급 지오메트리 (Spiral) 렌더링 기능 추가
- [x] **프롬프트**: Phase 1.3에서 분석한 `Spiral` 지오메트리 계산 알고리즘을 JavaScript로 구현하고, 이를 `OpenDriveViewer.js`의 `createRoadSegmentMesh` 함수에 통합해 주세요. `<geometry>` 요소 내에 `<spiral>` 태그가 존재할 경우, 해당 로직이 호출되어 나선형 곡선 참조선을 `THREE.Line`으로 생성하도록 구현합니다. Spiral 지오메트리를 포함하는 XODR 파일을 사용하여 렌더링 결과를 검증하고, 주요 계산 단계의 로그를 추가해 주세요. (필요시, `math.js`와 같은 외부 라이브러리 사용 검토)
    - **구현 대상**: `GeometryBuilder.js`의 `createRoadSegmentMesh` 함수 내 Spiral 처리 로직.
    - **참고 자료**: Phase 1.3 분석 결과, ASAM OpenDRIVE 사양서의 Spiral 정의.
    - **검증 방법**: Spiral 지오메트리 포함 XODR 파일 렌더링, 생성된 정점 데이터 검토.
    - **진행 상황**: `GeometryBuilder.js`에 Simpson's rule 기반 수치 적분 및 Spiral 계산 로직 구현 완료. 파란색으로 렌더링 확인.

### 2.4. 고급 지오메트리 (Poly3/ParamPoly3) 렌더링 기능 추가
- [x] **프롬프트**: Phase 1.3에서 분석한 `Poly3` 및 `ParamPoly3` 지오메트리 계산 알고리즘을 JavaScript로 구현하고, 이를 `OpenDriveViewer.js`의 `createRoadSegmentMesh` 함수에 통합해 주세요. `<geometry>` 요소 내에 `<poly3>` 또는 `<paramPoly3>` 태그가 존재할 경우, 해당 로직이 호출되어 3차 다항식 곡선 참조선을 `THREE.Line`으로 생성하도록 구현합니다. Poly3/ParamPoly3 지오메트리를 포함하는 XODR 파일을 사용하여 렌더링 결과를 검증하고, 상세 로깅을 추가해 주세요. (ParamPoly3의 경우 pRange 속성(`arcLength`, `normalized`) 처리 유의)
    - **구현 대상**: `GeometryBuilder.js`의 `createRoadSegmentMesh` 함수 내 Poly3/ParamPoly3 처리 로직.
    - **참고 자료**: Phase 1.3 분석 결과, ASAM OpenDRIVE 사양서의 Poly3/ParamPoly3 정의.
    - **검증 방법**: Poly3/ParamPoly3 지오메트리 포함 XODR 파일 렌더링, 생성된 정점 데이터 검토.
    - **진행 상황**: `GeometryBuilder.js`에 Poly3 및 ParamPoly3 계산 로직 구현 완료. 각각 녹색, 보라색으로 렌더링 확인.

### 2.5. 차선(Lane) 렌더링 로직 활성화 및 개선
- [ ] **프롬프트**: 현재 `OpenDriveViewer.js`에서 주석 처리된 `createLaneGroupForSegment` 함수를 다시 활성화하고, Phase 1.4 분석 결과를 바탕으로 차선 렌더링 로직을 개선해 주세요. 다음 사항을 중점적으로 구현/수정합니다:
    1.  도로 참조선(`roadData.centerLinePoints`) 및 각 지오메트리 세그먼트의 시작점/헤딩/곡률 정보를 활용하여 차선 정점 계산.
    2.  `<laneOffset>` 레코드의 다항식(a,b,c,d)을 적용하여 참조선으로부터의 횡방향 오프셋 계산.
    3.  `<lane>` 요소 내 `<width>` 레코드의 `sOffset` 및 다항식(a,b,c,d)을 적용하여 각 s위치에서의 차선 폭 계산.
    4.  계산된 차선 경계 정점들을 사용하여 `THREE.Mesh` (또는 `THREE.BufferGeometry`와 `LineLoop`을 사용한 닫힌 폴리곤)로 차선 면을 생성.
    5.  차선 ID (`<lane>`의 `id` 속성)에 따라 적절한 색상(예: 중앙선, 일반 차선, 좌/우 차선 구분) 적용.
    - **수정 대상**: `OpenDriveViewer.js`의 `createLaneGroupForSegment` 함수 및 관련 호출부.
    - **참고 자료**: Phase 1.4 분석 결과, `OpenDriveViewer.js`의 기존 차선 코드.
    - **검증 방법**: 차선이 포함된 XODR 파일 로드 후 시각적 확인 (참조선과의 정합성, 차선 폭 변화, 오프셋 적용 여부).

### 2.6. XML 파싱 및 데이터 중간 객체 구조 개선 (선택적 심화 작업)
- [x] **프롬프트**: (선택적 제안) 현재 `OpenDriveViewer.js`의 DOMParser와 XML 직접 순회 방식 대신, `Danaozhong/odrviewer`의 `model` 디렉토리처럼 OpenDRIVE 주요 요소(Road, LaneSection, Lane, Geometry 등)를 표현하는 JavaScript 클래스/객체 모델을 정의하고, XODR 파일 로드 시 이 객체들로 데이터를 파싱하여 저장하는 방식으로 리팩토링하는 것을 검토해 주세요. 이 방식의 장단점을 논의하고, 구현한다면 어떤 구조로 설계할지 제안해 주세요. (작업량이 크므로, 다른 기능 구현 후 고려 가능)
    - **검토 대상**: `OpenDriveViewer.js`의 데이터 파싱 및 관리 방식.
    - **참고 자료**: Phase 1.2 분석 결과.
    - **예상 결과물**: JavaScript 데이터 모델 설계안, 리팩토링 필요성 및 예상 효과 분석.
    - **진행 상황**: `OpenDriveParser.js` 수정하여, XML DOM 대신 구조화된 JavaScript 객체 모델(Header, Road, PlanView, Geometry 타입들, Lanes, LaneSection, Lane 등)을 반환하도록 변경 완료.

---

## Phase 3: 테스트, 디버깅 및 추가 기능 고려 (완성도 향상 단계)

**목표**: 구현된 기능들의 안정성을 확보하고, 다양한 테스트 케이스를 통해 문제점을 해결하며, 향후 확장성을 고려한 추가 기능 검토.

### 3.1. 종합 테스트 및 디버깅
- [ ] **프롬프트**: Phase 2에서 구현/개선된 모든 기능(직선, 원호, 나선형, 3차 다항식 참조선 및 차선 렌더링)에 대해 종합적인 테스트를 수행해 주세요. `Danaozhong/odrviewer` 프로젝트 내 샘플 파일, ASAM OpenDRIVE 공식 샘플 파일, `Germany_2018.xodr` 등 다양한 종류의 XODR 파일을 사용하여 렌더링 결과를 `Danaozhong/odrviewer` (QGIS 플러그인 실행 결과) 또는 `odrviewer.io`와 비교 검증해 주세요. 발견되는 모든 시각적 불일치, 오류, 성능 문제 등을 상세히 기록하고, 원인 분석 및 해결 방안을 `OpenDriveViewer.js` 코드에 적용해 주세요. 디버깅 창의 로그를 적극 활용합니다.
    - **테스트 대상**: `OpenDriveViewer.js` 전체 기능.
    - **비교 대상**: `Danaozhong/odrviewer` QGIS 플러그인, `odrviewer.io`.
    - **결과물**: 테스트 보고서 (버그 목록, 수정 내역, 비교 스크린샷).
    - **디버깅 로그 추가 작업 기록 (2024-07-08)**:
        - `OpenDriveParser.js`: 구조화된 JS 객체 반환 후 데이터 로딩 안 되는 문제 해결을 위해 파싱 과정 및 결과 객체에 대한 상세 로그 추가.
        - `OpenDriveViewer.js` (`MainController`): `loadFile` 함수 내 데이터 흐름 추적을 위해 `file.text()` 호출 전후, `sceneManager.clearScene()` 호출 전후, `uiManager.clearRoadList()` 호출 전후 로그 추가. `sceneManager.clearScene` 메소드 유효성 검사 로그 추가.
        - `SceneManager.js`: `clearScene()` 함수 내부 (씬 객체 탐색 및 제거 과정) 상세 로그 추가. `roadGroup` 및 `roadObjectsGroup` 변수명 일관성 확인.
        - `UIManager.js`: `clearRoadList()` 함수 내부 (DOM 요소 탐색, `innerHTML` 초기화 시도 및 결과) 상세 로그 추가. 생성자, `initUI`, `showLoading`, `showError`, `populateRoadList` 등 주요 UI 함수에도 로그 추가 및 로직 개선.
    - **최근 디버깅 상황 (2024-07-17)**:
        - **모듈 로딩 문제 해결**: `index.html`에 `importmap` 추가, 모든 로컬 `.js` 파일 `<script type="module">` 사용, 각 모듈 `export default ClassName;` 추가, `OpenDriveViewer.js`에 의존성 `import` 명시, `GeometryBuilder.js`에 `import * as THREE from 'three';` 추가, `SceneManager` 생성자에서 캔버스 동적 생성으로 `_canvas.getContext` 오류 해결. `OpenDriveViewer.js` 생성자 오류 처리 개선으로 이중 팝업 해결.
        - **UI 상호작용 디버깅 (완료)**: 체크박스 기능 관련 `SceneManager` 메소드 (`setReferenceLinesVisible` 등) 호출 오류 해결. `OpenDriveViewer.js` 내 `UIManager` 생성자 인자 전달 오류 수정, `handleRoadFocus` 콜백 바인딩 오류 수정 및 JavaScript 모듈 로딩 순서 조정을 통해 정상 작동 확인.
        - **UI 레이아웃 변경 (2024-07-17)**: "Display Options" 섹션 제거, "Roads" 체크박스 삭제, "Grid" 체크박스를 "Lane Types" 섹션으로 이동. 관련 HTML, UIManager, OpenDriveViewer 스크립트 수정.
        - **현재 디버깅 이슈 (2024-07-17 PAUSED)**: "Lane Types" (referenceLine, driving, sidewalk) 체크박스 클릭 시 `change` 이벤트가 발생하지 않아 관련 기능이 동작하지 않는 문제. `UIManager.js`의 `initLaneTypeCheckboxes`에서 이벤트 리스너는 성공적으로 등록되는 것으로 로그상 확인되나, 실제 이벤트 콜백은 트리거되지 않음. (상세 디버깅 내용은 `UIManager.js` 내 주석 참고)
        - **폭 계산 오류 해결 (2025-06-12)**  
            - `GeometryBuilder.getLaneWidthAt`에서 폭 세그먼트가 존재하지 않는 차로의 기본 폭을 **3.5 m → 0 m**로 변경.  
            - 단일 차로 폭이 **20 m**를 초과할 경우 경고를 출력하고 20 m로 클램핑하도록 가드 레일 추가.  
            - Road 29, 121 등에서 반복되던 `Abnormal width` 경고 다수 제거, 누적 폭 과다로 인한 도로 메시 왜곡 현상 해소.

### 3.2. UI/UX 개선 (지속)
- [ ] **프롬프트**: `odrviewer.io` 사이트의 UI/UX를 참고하여 현재 `index.html` 및 `OpenDriveViewer.js`의 사용자 인터페이스 관련 기능을 개선/확장해 주세요. 특히, Phase 2에서 렌더링 기능이 안정화됨에 따라 다음 항목들을 고려할 수 있습니다:
    1.  [x] 로드된 도로 목록을 좌측 패널에 표시하고, 선택 시 해당 도로로 카메라 포커스 기능 (`focusOnRoad` 활용).
    2.  [ ] 특정 도로 세그먼트 또는 차선 클릭 시 정보 표시 기능 (기초).
    3.  [x] 렌더링 옵션 제어:
        - UI 구성: "Display Options" 섹션 제거, "Roads" 토글 삭제, "Grid" 토글을 "Lane Types" 섹션으로 이동 완료 (2024-07-17).
        - 기능 상태:
            - "Lane Types" (참조선, Driving, Sidewalk 등): 체크박스 `change` 이벤트 미발생 이슈로 관련 기능 디버깅 중 (PAUSED, 상세 내용은 3.1절 및 UIManager.js 주석 참고).
            - "Grid" 토글: UI는 이동되었으나, Lane Types 이슈 해결 후 연계 기능 최종 확인 필요.
    - **수정 대상**: `index.html`, `OpenDriveViewer.js` (UI 관련 로직), `style.css`.
    - **참고 자료**: `odrviewer.io` UI/UX.
    - **진행 상황 (2024-07-17)**:
        - "로드된 도로 목록 표시 및 선택 시 카메라 포커스" 기능 및 "마우스 오버 툴팁" 기능 구현 완료.
        - "렌더링 옵션 제어" UI는 요구사항에 맞게 변경되었으나(상세 내용은 위 3번 항목 참고), "Lane Types" 체크박스의 이벤트 핸들링 문제로 일부 기능이 현재 미작동 상태입니다.
        - UI 레이아웃 요구사항에 따라 "Display Options" 제거, "Grid" 위치 변경 등 작업 완료.

### 3.3. 미지원 주요 OpenDRIVE 요소 처리 방안 논의 및 기초 조사
- [ ] **프롬프트 (Junctions)**: `Danaozhong/odrviewer`가 교차로(Junction) 정보를 어떻게 해석하고 시각화에 반영하는지 (또는 미지원 범위인지) 조사하고 요약해 주세요. 웹 뷰어에서 교차로 연결성을 표현하기 위한 기본적인 접근 방법(예: 연결 도로 정보 파싱, 가상 연결선 표시 등)에 대해 논의하고, 구현 가능성과 예상 복잡도를 평가해 주세요.
    - **조사 대상**: `Danaozhong/odrviewer`의 Junction 처리 방식.
    - **결과물**: Junction 처리 방식 분석 및 웹 뷰어 적용 방안 논의 자료.
- [ ] **프롬프트 (ElevationProfile & 3D)**: `Danaozhong/odrviewer`가 도로의 고도(Elevation) 정보를 처리하는지, 가능하다면 어떻게 3차원적 표현을 하는지 조사해 주세요. `OpenDriveViewer.js`에서 `<elevationProfile>`을 파싱하여 도로 참조선 및 차선에 Z값을 적용하고, 카메라 컨트롤을 3D 환경에 맞게 조정하기 위한 기본 아이디어와 구현 과제를 정리해 주세요. (매우 복잡할 수 있는 심화 과제)
    - **조사 대상**: `Danaozhong/odrviewer`의 Elevation 처리 및 3D 시각화 방식.
    - **결과물**: Elevation 처리 및 3D 시각화 방안 논의 자료.

### 3.4. 성능 최적화 검토 및 구현 (목표: 최소 30 FPS 확보)
- [ ] **프롬프트**: 매우 큰 XODR 파일(수백 MB 이상 또는 수백 km 도로망)을 로드했을 때 `OpenDriveViewer.js`의 로딩 시간, 렌더링 성능(FPS), 메모리 사용량 등을 측정하고 기록해 주세요. 성능 병목 지점(예: 복잡한 지오메트리 계산, 대량의 Three.js 객체 생성)을 파악하고, 가능한 최적화 방안(예: 지오메트리 단순화(LoD), BufferGeometry 최적화, InstancedMesh 사용, Web Worker를 이용한 백그라운드 파싱/계산)을 조사하여 제안해 주세요.
    - **대상**: 대용량 XODR 파일.
    - **결과물**: 성능 측정 결과 및 최적화 방안 제안서.
    - **세부 개선 항목 (우선순위 순)**:
        - [ ] **3.4.1 특정 도로 로드 실패 문제 디버깅 완료 (진행 중)**
            - **목표**: 모든 도로 데이터가 정확히 파싱되고 기본적인 지오메트리 생성이 가능하도록 보장합니다. Worker의 정규식 파싱 및 메인 스레드의 상세 파싱, 지오메트리 빌더 오류를 해결합니다.
        - [x] **3.4.2 선택적 렌더링 도입 (참조선)**
            - **프롬프트**: 기본적으로 참조선을 렌더링하지 않고, UI 토글을 통해 사용자가 원할 때만 참조선을 로드/렌더링하도록 `UIManager.js`, `OpenDriveViewer.js`, `SceneManager.js`, `GeometryBuilder.js`를 수정합니다.
            - **예상 결과물**: 초기 렌더링 객체 수 감소로 인한 즉각적인 FPS 향상 및 로딩 시간 단축.
        - [ ] **3.4.3 순차 로딩 (`loadRemainingRoadsSequentially`) 시 시간 분할(Time Slicing) 강화**
            - **프롬프트**: `OpenDriveViewer.js`의 `loadRemainingRoadsSequentially` 함수 내부에서 도로 하나를 상세 파싱하고 지오메트리(차선 등)를 생성하는 각 주요 단계(예: 상세 파싱 후, 차선 지오메트리 생성 후) 사이에 `setTimeout(resolve, 0)`을 사용하여 메인 스레드에 제어권을 넘겨 UI 반응성을 개선합니다.
            - **예상 결과물**: 백그라운드 도로 로딩 중 UI 끊김 현상 완화 및 FPS 안정성 향상.
        - [ ] **3.4.4 LOD(Level of Detail) - `pointInterval` 동적 조절**
            - **프롬프트**: `GeometryBuilder.js`에서 지오메트리 생성 시 `pointInterval` 값을 카메라와의 거리 또는 도로의 복잡도에 따라 동적으로 조절하는 로직을 추가합니다. (예: 멀거나 단순한 도로는 `pointInterval` 증가)
            - **예상 결과물**: 전체 정점 수 감소로 렌더링 부하 감소 및 FPS 향상.
        - [ ] **3.4.5 Web Worker 활용 확대 (상세 정보 처리 지원 및 지오메트리 계산)**
            - **프롬프트**: (선택적 고급 최적화) `parseRoadDetails`의 일부 문자열 기반 상세 정보 추출 또는 `GeometryBuilder`의 복잡한 수학적 계산(예: Spiral)을 Web Worker로 이전합니다. Worker는 계산된 정점 배열 등을 메인 스레드로 전달하고, 메인 스레드는 이를 Three.js 객체로 변환합니다.
            - **예상 결과물**: CPU 집약적 작업을 백그라운드로 이전하여 메인 스레드 부담을 크게 줄이고 FPS 향상.
            - **세부 진행 단계 재검토**:
                - [ ] **3.4.5.1 `parseInitial` Worker 안정화 (현재 진행)**: Worker가 모든 도로의 기본 정보를 오류 없이 정확하게 추출하도록 보장 (정규식 등 개선).
                - [ ] **3.4.5.2 (제안) `GeometryBuilder`의 일부 계산 Worker 이전**: 예: Spiral, Poly3 곡선 정점 계산 Worker로 이전.
        - [ ] **3.4.6 (선택적) 지오메트리 병합 (Geometry Merging)**
            - **프롬프트**: `GeometryBuilder.js` 또는 `SceneManager.js`에서, 동일한 재질을 사용하는 다수의 `THREE.Line` 또는 `THREE.Mesh` 객체들을 `BufferGeometryUtils.mergeBufferGeometries`를 사용하여 병합, `draw call` 수를 줄입니다.
            - **예상 결과물**: `draw call` 감소로 인한 렌더링 성능 향상.
        - [ ] **3.4.7 (선택적 장기 과제) 영역 선택 로딩 기능 (Bounding Box 기반)**
            - **프롬프트**: 사용자가 지도 위에서 사각 영역을 선택하면 해당 영역 내 도로만 로드/렌더링하는 기능을 추가합니다. 도로의 바운딩 박스 계산 및 공간 필터링 로직이 필요합니다.
            - **예상 결과물**: 대규모 데이터셋에서 관심 영역 집중 로드로 인한 로딩/렌더링 부하 획기적 감소.

### (기존 파싱 관련 항목에 아래 문구 추가)
- [ ] **파싱 구조 개선**: JS 파서 외에 C++ 파서(WASM/서버) 대체 실험 및 성능 비교, 최적 구조 채택.

---

## Phase 4: C++ 파서 도입 및 파싱 구조 고도화 (성능 극대화 실험)

### ✔️ 4.1. C++ 파서 연동 설계 (완료)
- **주요 결과**: WASM(WebAssembly) 방식이 최우선 전략으로 선정. 서버 방식은 차선책.
- **산출물**: 설계 다이어그램, 장단점 비교, 보안·배포 이슈 정리 (analysis.md 4.x 절 참조).

### ⚙️ 4.2. C++ 파서 WASM 빌드 및 브라우저 내 파싱 실험 (진행 중 – 1차 성공)
- **완료 사항**
  1. `libOpenDRIVE-main` + `pugixml` + `nlohmann/json` → `OpenDriveWasm.js / .wasm` 생성 스크립트(`build_wasm.sh`) 작성.
  2. Git Bash + Emscripten SDK 환경에서 **빌드 성공**(2025-06-12).
  3. `OpenDriveViewer.js`에 **WASM 모듈(default export) 로드** 및 기존 JS/Worker 파서 제거.
  4. 브라우저 콘솔에 `WASM module ready` 메시지 확인, 스텁 파서(JSON `{length: …}`) 호출 성공.
- **다음 작업**
  - [ ] `wasm_parser_wrapper.cpp` 를 실제 파싱 로직(`odr::OpenDriveMap`) + `nlohmann::json` 직렬화로 교체.
  - [ ] JS → Three.js 파이프라인 연결(Road List → 지오메트리 렌더링).

### 4.3. 서버 연동(REST API) 실험 (대기)
- **상태**: WASM 방식 안정화 후 착수 예정.

### 4.4. 전체 파이프라인 통합 및 최적화 (예정)
- **선행조건**: 4.2 실제 파싱 JSON 구조 확정.

### 4.2.1 진행 상황 업데이트 (2025-06-12)
- **스텁 JSON 파서 오류 해결 시도**: `wasm_parser_wrapper.cpp`의 누락된 JSON 키 인용 문제 수정 → 브라우저 JSON 파싱 오류 해결.
- **그러나**: pugixml 기반 스텁은 지오메트리·차선 정보 축약으로 실전 사용 어려움 확인.
- **결정**: libOpenDRIVE 의 `odr::OpenDriveMap` 정식 파서를 WASM 으로 빌드해 사용하기로 재전환.
    - 입력 XODR 문자열을 **MEMFS `/tmp/xodr_*.xodr`** 에 저장한 후 `OpenDriveMap` 생성자를 호출.
    - nlohmann::json 으로 JS 친화 경량 스키마 직렬화.
- **설계 스케치**: `parseOpenDrive(xodrString) -> string(JSON)`; 내부 함수 `writeMemFile`, `buildOpenDriveMap`, `mapToJson` 로 SRP 분리.

#### 내일 예정 작업 (2025-06-13)
1. **환경 정비**
    - [ ] `external/libOpenDRIVE` 서브모듈 init & fetch.
    - [ ] `nlohmann/json` 헤더 추가 (`external/json`).
2. **WASM 래퍼 구현** (`src/opendrive_wasm.cpp`)
    - [ ] `writeMemFile` 구현 (MEMFS 저장).
    - [ ] `parseOpenDrive` 구현 (`OpenDriveMap` 호출 → json 직렬화).
    - [ ] `mapRoad` / `mapLaneSection` 등 헬퍼 함수 설계.
3. **빌드 스크립트 업데이트** (`build_wasm.sh`)
    - [ ] `USE_STD_FILESYSTEM=1` 플래그 추가.
    - [ ] 필요 소스 제외/포함 목록 조정.
4. **JS 연동**
    - [ ] `OpenDriveViewer.js` 에 `parseOpenDrive` 호출 & 로딩 UI.
    - [ ] 새 JSON 스키마에 맞춰 `SceneManager.loadFromJson` 작성.
5. **간단 테스트 케이스**
    - [ ] `Crossing8Course.xodr` 로딩 → 도로 수/길이 검증.
    - [ ] console.assert(JSON.parse(json).roads.length > 0).
6. **문서화**
    - [ ] README 빌드 지침 업데이트.

> *커서 룰 – SRP, 독립적 배포 가능성, 테스트 용이성, 가독성 고려하여 단계별로 진행*

--- 