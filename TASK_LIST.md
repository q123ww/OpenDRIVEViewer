# 📖 **OpenDRIVE 3D 뷰어 시스템 개발 지침 (LLM용)**

## 🎯 **프로젝트 목표**
OpenDRIVE(.xodr) 파일을 로컬에서 로드하여 웹 브라우저에 3D 렌더링하고, 주행 차량 주변의 도로 환경을 시각적으로 표현하는 시스템을 구축합니다.

## 1. 핵심 기능 및 기술 스택

각 시스템 기능별로 필요한 기술 요소와 개발 방향을 명확히 정의합니다.

### 1.1 데이터 로딩 및 파싱 (Data Loading & Parsing)

- **입력**: 사용자가 로컬 환경에서 .xodr 파일을 선택하고 읽을 수 있도록 합니다.
  - 필수 요소: HTML `<input type="file" accept=".xodr">`, JavaScript FileReader API.
- **파싱 엔진**: .xodr 파일의 복잡한 XML 구조를 해석하고, 도로 지오메트리, 차선 정보, 신호, 표지판 등의 OpenDRIVE 데이터를 프로그램이 다루기 쉬운 형태로 변환합니다.
  - 주요 기술: WebAssembly (WASM).
    - 기반 라이브러리: libOpenDRIVE (C++).
    - 컴파일 도구: Emscripten을 사용하여 libOpenDRIVE의 C++ 코드를 .wasm 모듈과 JS 바인딩(ModuleOpenDrive.js)으로 컴파일합니다.
    - 역할: 파싱 로직을 WASM으로 처리하여 웹 환경에서 고성능으로 동작하도록 합니다. 파싱 결과는 3D 렌더링에 필요한 구조화된 데이터(예: 도로 기준점 좌표, 차선 경계선, 곡률 정보 등)여야 합니다.

### 1.2 3D 렌더링 (3D Rendering)

- **시각화 엔진**: 파싱된 OpenDRIVE 데이터를 기반으로 도로 환경을 3D로 시각화합니다.
  - 주요 기술: Three.js (웹 기반 3D 그래픽 라이브러리).
    - 캔버스: 3D 장면이 렌더링될 `<canvas>` HTML 요소를 사용합니다.
    - 장면 구성: THREE.Scene, THREE.Camera (PerspectiveCamera), THREE.Light (AmbientLight, DirectionalLight)를 설정합니다.
    - 지오메트리 생성: 파싱된 OpenDRIVE 데이터(예: 도로 기준선, 차선 경계)를 Three.js의 THREE.Line, THREE.Mesh 등의 지오메트리 및 재질로 변환하여 렌더링합니다.
    - 성능 최적화: WASM 스트리밍 컴파일, LOD, Frustum Culling 등 3D 렌더링 성능 최적화 기법을 고려합니다.
- **초기 Display**:
  - 초기 프로토타입/개념 증명: 간단한 HTML 파일 내에서 직접 Three.js 및 필요한 스크립트(ModuleOpenDrive.js, ModuleOpenDrive.wasm)를 로드하고, 바닐라 JavaScript로 UI와 렌더링 로직을 구현합니다.
- **완성형 Display**:
  - 최종 시스템: React 프레임워크를 사용하여 UI 컴포넌트를 구성하고, 상태 관리를 효율적으로 수행합니다. Three.js 렌더링 로직을 React 컴포넌트 내에서 관리합니다.

### 1.3 프론트엔드 UI 및 상호작용 (Frontend UI & Interaction)

- **사용자 인터페이스**: 파일 선택, 로딩 상태 표시, 오류 알림, 3D 뷰어 제어 등 직관적인 UI를 제공합니다.
  - UI 프레임워크: 기능 개발 중에서는 html의 간소한 프레임워크를 사용합니다. 개발 완료시 React 컴포넌트 기반으로 구축합니다.
  - 스타일링: Tailwind CSS를 활용하여 반응형 디자인과 현대적인 UI를 구현합니다.
  - 상태 관리: React의 useState, useEffect, useRef를 기본으로 사용하고, 필요시 Context API 또는 외부 라이브러리(Zustand 등)를 고려합니다.
- **3D 뷰어 컨트롤**: 사용자가 3D 장면을 탐색할 수 있도록 마우스 기반의 카메라 제어 기능을 제공합니다.
  - 필수 요소: Three.js의 OrbitControls (또는 유사한 커스텀 컨트롤)를 통합하여 확대/축소, 회전, 이동(패닝) 기능을 구현합니다.

## 2. 웹 버전 소프트웨어 개발에 필요한 추가 구성요소

성공적인 웹 애플리케이션 개발을 위한 필수적인 인프라 및 지침입니다.

- **개발 환경**:
  - 개발 서버: 로컬에서 앱을 실행하고 테스트할 수 있는 경량 웹 서버 (예: http-server 또는 Python의 http.server).
  - 모듈 번들러: Webpack, Vite 등 (React 프로젝트에서 보통 내장).
  - 트랜스파일러: Babel (JSX 및 최신 JS 문법 변환).
  - 종속성 관리: npm 또는 yarn.
- **코드 품질 및 유지보수**:
  - 모듈화된 코드: 각 기능(파서, 렌더러, UI 컴포넌트)을 독립적인 모듈로 분리하여 재사용성과 유지보수성을 높입니다.
  - 주석 및 문서화: 코드 내에 풍부하고 명확한 주석을 달아 로직과 구현 의도를 설명합니다.
  - 오류 처리: 파일 로딩 실패, WASM 모듈 로딩/실행 오류, 파싱 오류 등 모든 잠재적 오류에 대해 사용자에게 친화적인 메시지를 제공하고 개발자 콘솔에 상세 로그를 출력합니다.

**지시 사항**: 위에 정의된 기능과 기술 스택을 바탕으로, 요구사항에 맞는 코드를 단계별로 생성하거나, 특정 기능 구현에 대한 상세한 가이드를 제공해 주세요. 각 기능 구현 시에는 모듈성, 성능, 사용자 경험을 최우선으로 고려해야 합니다.

---

## 📝 **커서 룰 적용 원칙**

1. **단일 책임 원칙**: 각 Phase는 명확한 단일 목표를 가짐
2. **점진적 진화**: 기존 Three.js 렌더링 파이프라인을 최대한 재사용
3. **독립적 배포 가능성**: 각 Phase 완료 후 독립적으로 테스트 가능
4. **시스템 사고**: libOpenDRIVE-0.3.0의 전체 아키텍처를 이해하고 활용
5. **비용-혜택 분석**: 검증된 솔루션 활용으로 개발 리스크 최소화

> 📑 **프로젝트 전환**: 기존 JSON 직렬화 방식에서 libOpenDRIVE-0.3.0의 직접 메쉬 생성 방식으로 전환
> 📍 **작업경로**: /home/vtd/Documents/Github/OpenDRIVEViewer
> 📍 **기존자료백업경로**: /home/vtd/Documents/Github/OpenDRIVEViewer/backup
> 📍 **Testfile**: Germany_2018.xodr(대용량, 현재 사용 중), Crossing8Course.xodr(소용량)

## 📋 **상세 단계별 개발 계획**

---

# 🚀 **Phase 0: 유사 프로젝트 분석 및 뼈대 차용**

### 1. 벤치마크 대상 분석

#### 1.1. odrviewer.io
- **주소**: [https://odrviewer.io/](https://odrviewer.io/)
- **기존 분석**: Webserver 구동 원리 (parser, display, frame work) 및 *.js, *.css 파일 구조를 참고 대상으로 함.
- **상세 분석**:
    - **아키텍처**: 100% 클라이언트 측 렌더링(Client-Side Rendering) 모델로, 서버는 정적 파일(HTML, JS, CSS, WASM) 제공 역할만 수행. 이는 현재 우리 프로젝트의 접근 방식과 일치함.
    - **핵심 기술**: C++ `libOpenDRIVE`를 Emscripten으로 컴파일한 **`viewer.wasm`**을 파서로 사용하며, **`Three.js`**로 렌더링. UI는 별도 프레임워크 없이 바닐라 JS로 구현하여 경량화를 추구.
- **우리 프로젝트에 차용할 기술**:
    - **WASM 기반 고성능 파싱**: `libOpenDRIVE` + WASM 방식이 업계 표준임을 재확인. 이 기술 방향을 유지 및 심화.
    - **WASM 메모리 직접 접근**: `odrviewer.io`는 WASM 메모리(Heap)에 직접 접근하여 Three.js 지오메트리를 생성. 이는 데이터 복사 오버헤드를 줄이는 핵심 성능 최적화 기법으로, 우리 프로젝트의 `createMeshFromOdr` 함수처럼 적극 활용해야 함.

#### 1.2. pageldev/libOpenDRIVE (v0.3.0)
- **주소**: [https://github.com/pageldev/libOpenDRIVE/tree/0.3.0](https://github.com/pageldev/libOpenDRIVE/tree/0.3.0)
- **기존 분석**: WASM 바인딩을 포함한 핵심 C++ 파싱 로직의 원천. `Viewer/` 디렉토리에서 WASM 모듈 로딩 및 사용 예시 확인.
- **상세 분석**:
    - **WASM 연동 구조**: `src/Embind.cpp` 파일이 C++ 코드(함수, 클래스)를 JavaScript에 노출시키는 '접착제' 역할을 함.
    - **데이터 변환**: `Viewer/` 디렉토리의 유틸리티 함수(예: `get_road_network_mesh`)는 순수 OpenDRIVE 데이터를 3D 렌더링에 적합한 정점/인덱스 배열로 가공하는 역할을 수행.
- **우리 프로젝트에 차용할 기술**:
    - **C++ 헬퍼 함수 활용**: 복잡한 연산이나 데이터 필터링은 JavaScript 대신 C++ 헬퍼 함수로 구현하고 WASM으로 노출시켜 성능과 유지보수성을 확보하는 것이 바람직함.
    - **빌드 프로세스 이해**: `CMakeLists.txt` 내 `if(EMSCRIPTEN)` 분기문을 이해하여 향후 빌드 옵션 최적화 및 경량 모듈 생성에 활용.

#### 1.3. Saquib764/opendrivejs
- **주소**: [https://github.com/Saquib764/opendrivejs](https://github.com/Saquib764/opendrivejs)
- **기존 분석**: WASM 없이 순수 JavaScript 기반으로 XML을 파싱하여 시각화하는 대안 프로젝트.
- **상세 분석**:
    - 도로의 기본 형상 파싱은 가능하나, OpenDRIVE의 복잡한 사양(차선 연결, 교차로 등)은 완벽히 지원하지 못하는 한계가 명확함.
- **우리 프로젝트에 차용할 기술**:
    - **기술 선택의 타당성 확보**: 이 프로젝트와의 비교를 통해, OpenDRIVE의 복잡성을 고려했을 때 검증된 C++ 라이브러리를 WASM으로 활용하는 현재 우리의 기술 선택이 성능과 안정성 면에서 월등히 우수함을 확인함.

---

### 2. 종합 결론 및 기술 전략

**분석 결과, 현재 우리 프로젝트가 채택한 `libOpenDRIVE(C++) + Emscripten(WASM) + Three.js` 기술 스택은 관련 분야에서 가장 효율적이고 검증된 표준 아키텍처임이 확인되었습니다.**

향후 개발은 이 기술 스택을 기반으로 다음과 같은 전략을 적용합니다.
1.  **성능 중심 설계**: WASM 메모리 직접 접근을 표준화하여 데이터 복사 오버헤드를 최소화합니다.
2.  **역할 분담 명확화**: 복잡한 연산 및 데이터 처리는 C++ 헬퍼 함수로 구현하고, UI 및 사용자 상호작용은 JavaScript/Three.js에서 담당하도록 역할을 명확히 분리합니다.
3.  **점진적 UI 발전**: 현재의 바닐라 JS 기반 UI로 핵심 기능 개발을 완료한 후, 필요시 React와 같은 프레임워크를 도입하여 UI 완성도를 높입니다.

# 🚀 **Phase 0: 기초 환경 구축 및 검증**
*목표: 개발 환경 설정 및 기본 동작 검증*

## Phase 0.1: 개발 환경 설정 (Day 1)
### 작업 내용:
- [x] **프로젝트 디렉토리 구조 확인**
- [x] **기존 파일 백업**
- [x] **필수 도구 설치 확인** (`emcc`, `cmake` 등)
  - `emcc` 경로 문제 발생 후 `emsdk_env.sh` 실행으로 해결

### 🎯 **확인 가능한 결과물:**
- [x] 콘솔에 각 도구의 버전 정보 출력
- [x] 백업 파일 생성 확인

---

## Phase 0.2: libOpenDRIVE-0.3.0 빌드 테스트 (Day 1)
### 작업 내용:
- [x] **libOpenDRIVE-0.3.0 CMakeLists.txt 분석** (암시적으로 수행)
- [x] **WASM 빌드 시도** (`emcmake`, `emmake` 사용)
- [x] **생성된 파일 확인**

### 🎯 **확인 가능한 결과물:**
- [x] 빌드 성공 시 `ModuleOpenDrive.wasm`, `ModuleOpenDrive.js` 파일 생성
- [x] 빌드 로그에서 에러 없이 완료 메시지 확인

---

## Phase 0.3: 기본 HTML 테스트 페이지 작성 (Day 1)
### 작업 내용:
- [x] **최소한의 HTML 테스트 페이지 생성 (`index.html`)**
  - WASM 로딩 스크립트 포함
  - 로딩 상태(성공/실패)를 표시할 `div` 요소 포함

### 🎯 **확인 가능한 결과물:**
- [x] 브라우저에서 "WASM 모듈 로딩 성공!" 메시지 표시
- [x] 개발자 콘솔에 libOpenDRIVE 모듈 객체 출력
- [x] 초기 로딩 경로 문제(`404 Not Found`) 및 MIME 타입 오류 발생, 서버 실행 위치와 JS 바인딩(`libOpenDrive()`) 수정으로 해결

---

# 🔧 **Phase 1: 파일 로딩 및 파싱 기능 구현**
*목표: XODR 파일을 브라우저에서 로드하고 파싱하는 기능 구현*

## Phase 1.1: 자동 파일 로딩 구현
### 작업 내용:
- [x] **초기 계획 변경**: 수동 파일 선택 UI 대신, 페이지 로드 시 특정 맵 파일을 자동으로 불러오는 방식으로 변경.
- [x] **`fetch` API를 사용한 파일 로딩**: JavaScript `fetch` API로 지정된 경로의 `.xodr` 파일을 비동기적으로 로드.

### 🎯 **확인 가능한 결과물:**
- [x] 페이지 로드 시 자동으로 `Maps/Germany_2018.xodr` 파일 로드.

---

## Phase 1.2: XODR 파일 메모리 로딩 (Day 2)
### 작업 내용:
- [x] **파일을 WASM 메모리에 로드하는 함수 구현** (`loadAndParseUrl`)
  - `File` 객체를 `Uint8Array`로 변환.
  - WASM 파일 시스템에 파일 쓰기 (`Module.FS_createDataFile` 사용, 초기 `writeFile` 접근 방식에서 수정).
  - 초기 `unlink` 시도에서 발생한 `errno: 44` (ENOENT) 오류를 `unlink` 제거로 해결.

### 🎯 **확인 가능한 결과물:**
- [x] 콘솔에 "파일 로드 완료" 메시지와 파일 크기 정보.
- [x] WASM 가상 파일 시스템에 `/default.xodr` 파일 성공적으로 생성.

---

## Phase 1.3: OpenDRIVE 파싱 구현 (Day 2-3)
### 작업 내용:
- [x] **`OpenDriveMap` 객체 생성 및 파싱**
  - 생성자 인자 개수 불일치 `BindingError` 발생.
  - `Embind.cpp` 분석을 통해 생성자가 `(string, object)` 두 개의 인자를 필요로 함을 파악하고, `OpenDriveMapConfig` 객체를 추가하여 해결.
- [x] **파싱된 데이터 접근 방법 수정**
  - `map.get_road_count()` 접근 시 `TypeError` 발생.
  - `Embind.cpp` 재분석 결과, 관련 함수가 `OpenDriveMap`의 멤버가 아닌 전역 함수(`get_road_network_mesh`)로 바인딩된 것을 확인.
  - `Module.get_road_network_mesh(map, ...)` 호출로 수정하여 `RoadNetworkMesh` 객체를 획득하는 방식으로 해결.

### 🎯 **확인 가능한 결과물:**
- [x] 콘솔에 "OpenDRIVE 파싱 성공" 메시지.
- [x] `RoadNetworkMesh` 객체로부터 도로 개수(`road_start_indices.size()`)를 성공적으로 추출 및 출력.

---

# 🎨 **Phase 2: 기본 3D 렌더링 구현**
*목표: Three.js를 사용하여 기본적인 3D 장면 렌더링*

## Phase 2.1: Three.js 기본 장면 설정 (Day 3)
### 작업 내용:
- [x] **Three.js 기본 설정** (Scene, PerspectiveCamera, WebGLRenderer, Lights)
- [x] **3D 뷰어 컨테이너 추가**: `index.html`에 3D 뷰가 렌더링될 `viewer-container` div 추가.
- [x] **디버그 패널 추가**: 파싱된 원시 데이터를 표시하기 위한 우측 디버그 패널 레이아웃 구현.

### 🎯 **확인 가능한 결과물:**
- [x] 브라우저에 3D 캔버스와 디버그 패널이 좌우로 나뉘어 표시됨.
- [x] 디버그 패널에 파싱된 메쉬 데이터(Vertices, Indices) 출력.

## Phase 2.2: 도로 네트워크 메쉬 렌더링
### 작업 내용:
- [x] **WASM 데이터를 Three.js 지오메트리로 변환**: `createThreeMeshFromOdrMesh` 헬퍼 함수 구현.
- [x] **좌표계 변환**: `Vec3D` 데이터가 자바스크립트 배열 `[x, y, z]`로 변환됨을 확인. 초기 `vec.get()` 접근 시 발생한 `TypeError`를 `vec[0]` 방식의 인덱스 접근으로 수정.
- [x] **Z-up to Y-up 변환**: OpenDRIVE(Z-up)과 Three.js(Y-up)의 좌표계 불일치 문제 해결. `(x, y, z)`를 `(x, z, y)`로 매핑하여 도로가 바닥에 평평하게 렌더링되도록 수정.
- [x] **차선, 도로표시, 도로시설물 렌더링**: 각 메쉬 데이터에 서로 다른 재질(Material)을 적용하여 씬에 추가.

### 🎯 **확인 가능한 결과물:**
- [x] 3D 장면에 회색 차선 표면이 렌더링됨.

## Phase 2.3: 기본 카메라 컨트롤 및 뷰 자동 조정 (Day 4)
### 작업 내용:
- [x] **`OrbitControls` 추가** 및 애니메이션 루프 설정.
- [x] **맵 크기 자동 감지**: 렌더링된 모든 객체를 포함하는 경계 상자(`BoundingBox`) 계산.
- [x] **카메라 및 컨트롤 자동 조정**: 경계 상자 정보를 기반으로 카메라의 위치와 `far` plane, `OrbitControls`의 `target`을 동적으로 설정하여 맵 전체가 화면에 보이도록 함.
- [x] **그리드 크기 자동 조정**: 경계 상자 크기에 맞춰 `GridHelper`의 크기와 위치를 동적으로 설정.
- [x] **그리드 간격 설정**: 사용자의 요청에 따라 그리드 한 칸이 100m가 되도록 분할 수(`divisions`)를 동적으로 계산하는 로직 추가.

### 🎯 **확인 가능한 결과물:**
- [x] 마우스로 3D 장면을 회전, 확대/축소, 이동 가능.
- [x] 어떤 크기의 맵을 로드하든 카메라가 자동으로 맵 전체를 비춰줌.
- [x] 그리드가 맵 전체를 덮으며, 간격이 100m로 설정됨.

---

# 🛣️ **Phase 3: 도로 네트워크 상세 렌더링**
*목표: 차선, 도로 표시 등 상세한 도로 요소 렌더링*
> **현재 Phase 2에서 차선 및 도로표시 렌더링이 완료되었으므로, Phase 3의 내용은 사실상 Phase 2에 통합되어 완료됨.**

## Phase 3.1: 차선 메쉬 렌더링 (Day 5)
### 작업 내용:
- [x] **도로 네트워크 메쉬 데이터 추출** (완료)
- [x] **차선 메쉬 렌더링** (완료)

### 🎯 **확인 가능한 결과물:**
- [x] 3D 장면에 회색 차선 표면이 렌더링됨.

---

## Phase 3.2: 도로 표시(Road Marks) 렌더링 (Day 5-6)
### 작업 내용:
- [x] **도로 표시 메쉬 추가** (완료)

### 🎯 **확인 가능한 결과물:**
- [x] 3D 장면에 흰색 도로 표시선들이 렌더링됨.

---

## Phase 3.3: 렌더링 품질 개선 (Day 6)
### 작업 내용:
- [ ] **와이어프레임 모드 토글**
- [ ] **그림자(Shadow) 렌더링 추가**

### 🎯 **확인 가능한 결과물:**
- [ ] 'W' 키 입력으로 와이어프레임 모드 전환 가능
- [ ] 동적 그림자가 렌더링되어 사실감 향상

---

# 🎛️ **Phase 4: 사용자 인터페이스 및 상호작용**
*목표: 직관적인 UI와 인터랙티브 기능 구현*

## Phase 4.1: 레이어 가시성 제어 (Day 7)
### 작업 내용:
- [ ] **레이어 제어 UI 생성**
  ```html
  <div id="controls">
      <h3>레이어 제어</h3>
      <label><input type="checkbox" id="show-reflines" checked> 참조선</label><br>
      <label><input type="checkbox" id="show-lanes" checked> 차선</label><br>
      <label><input type="checkbox" id="show-roadmarks" checked> 도로 표시</label><br>
  </div>
  ```

### 🎯 **확인 가능한 결과물:**
- 체크박스로 각 레이어 on/off 가능
- 실시간으로 렌더링 요소 표시/숨김 확인
- UI 패널이 3D 장면 위에 오버레이로 표시

---

## Phase 4.2: 마우스 피킹 및 정보 표시 (Day 7-8)
### 작업 내용:
- [ ] **마우스 피킹 시스템 구현**
  ```javascript
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  function onMouseClick(event) {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children);
      
      if (intersects.length > 0) {
          const selectedObject = intersects[0].object;
          console.log('선택된 객체:', selectedObject);
          // 선택된 객체 하이라이트
          selectedObject.material.emissive.setHex(0x444444);
      }
  }
  
  renderer.domElement.addEventListener('click', onMouseClick);
  ```

### 🎯 **확인 가능한 결과물:**
- 마우스 클릭으로 도로 요소 선택 가능
- 선택된 객체가 하이라이트됨
- 콘솔에 선택된 객체 정보 출력

---

# 🚀 **Phase 5: 성능 최적화 및 완성도 향상**
*목표: 대용량 파일 처리 및 사용자 경험 개선*

## Phase 5.1: 성능 모니터링 (Day 8)
### 작업 내용:
- [ ] **FPS 및 렌더링 통계 표시**
  ```javascript
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  
  function animate() {
      stats.begin();
      
      // 렌더링 로직
      controls.update();
      renderer.render(scene, camera);
      
      stats.end();
      requestAnimationFrame(animate);
  }
  ```

### 🎯 **확인 가능한 결과물:**
- 화면 좌상단에 FPS 및 렌더링 시간 표시
- 성능 병목 지점 식별 가능
- 메모리 사용량 모니터링

---

## Phase 5.2: 에러 처리 및 사용자 피드백 (Day 9)
### 작업 내용:
- [ ] **종합적인 에러 처리 시스템**
  ```javascript
  function showError(message) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.innerHTML = `❌ ${message}`;
      document.body.appendChild(errorDiv);
      
      setTimeout(() => {
          document.body.removeChild(errorDiv);
      }, 5000);
  }
  
  function showSuccess(message) {
      const successDiv = document.createElement('div');
      successDiv.className = 'success-message';
      successDiv.innerHTML = `✅ ${message}`;
      document.body.appendChild(successDiv);
      
      setTimeout(() => {
          document.body.removeChild(successDiv);
      }, 3000);
  }
  ```

### 🎯 **확인 가능한 결과물:**
- 에러 발생 시 사용자 친화적 메시지 표시
- 성공 동작 시 확인 메시지 표시
- 메시지가 자동으로 사라짐

---

---

## 📊 **각 Phase별 예상 소요 시간**
- **Phase 0**: 1일 (환경 설정)
- **Phase 1**: 2일 (파일 로딩/파싱)
- **Phase 2**: 2일 (기본 렌더링)
- **Phase 3**: 2일 (상세 렌더링)
- **Phase 4**: 2일 (UI/상호작용)
- **Phase 5**: 1일 (최적화)

**총 예상 소요 시간: 10일**

## 🧪 **로컬 테스트 가이드**
각 Phase 완료 후 다음 XODR 파일들로 기능을 확인하세요:
- **단순 테스트**: 직선 도로 (.xodr)
- **중간 테스트**: 곡선 도로 (.xodr)
- **복잡 테스트**: 교차로가 포함된 도로 (.xodr)

### 🎯 **확인 가능한 결과물:**
- 브라우저에서 각 XODR 파일의 3D 렌더링 확인
- 콘솔에서 파싱 및 렌더링 로그 확인
- 성능 모니터링 도구를 통한 FPS 및 메모리 사용량 확인

## 🔄 **중간 확인 포인트**
각 Phase의 세부 작업 완료 시마다 다음을 확인:
1. 콘솔 출력 메시지 확인
2. 브라우저 화면 시각적 결과 확인
3. 개발자 도구에서 네트워크/성능 탭 확인
4. 에러 로그 여부 확인

이를 통해 다음 단계 진행 전에 문제점을 발견하고 수정할 수 있습니다.

---

## 🚀 **즉시 시작할 작업 (우선순위 1)**

### 1. 환경 설정 (오늘)
```bash
# 1. 기존 파일 백업
mv libOpenDRIVE-main libOpenDRIVE-main.backup
mv wasm_parser_wrapper.cpp wasm_parser_wrapper.cpp.backup

# 2. libOpenDRIVE-0.3.0 활용 준비
cd libOpenDRIVE-0.3.0
```

### 2. 빌드 테스트 (오늘)
- libOpenDRIVE-0.3.0의 CMakeLists.txt를 사용한 WASM 빌드 시도
- ModuleOpenDrive.js 생성 확인

### 3. 기본 연동 (내일)
- OpenDriveViewer.js에서 libOpenDrive() 모듈 로딩
- 간단한 XODR 파일로 OpenDriveMap 생성 테스트

---

## 📝 **커서 룰 적용 원칙**

1. **단일 책임 원칙**: 각 Phase는 명확한 단일 목표를 가짐
2. **점진적 진화**: 기존 Three.js 렌더링 파이프라인을 최대한 재사용
3. **독립적 배포 가능성**: 각 Phase 완료 후 독립적으로 테스트 가능
4. **시스템 사고**: libOpenDRIVE-0.3.0의 전체 아키텍처를 이해하고 활용
5. **비용-혜택 분석**: 검증된 솔루션 활용으로 개발 리스크 최소화
