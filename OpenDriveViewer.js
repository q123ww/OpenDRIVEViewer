import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { SceneManager } from './SceneManager.js?v=20250614c';
import { UIManager } from './UIManager.js';
import { GeometryBuilder } from './GeometryBuilder.js';
import { DebugLogger } from './DebugLogger.js';
import loadWasmModule from './OpenDriveWasm.js?v=20250614e';
// THREE는 SceneManager 등에서 import 하므로 여기서는 직접 import 필요 없을 수 있음
// import * as THREE from 'three'; 

export class OpenDriveViewer {
    constructor() {
        this.logger = new DebugLogger('OpenDriveViewer');
        this.logger.log('Constructing OpenDriveViewer...');
        
        this.wasm = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.uiManager = null;
        this.sceneManager = null;
        this.geometryBuilder = null;
    }

    async init() {
        this.logger.log('Initializing OpenDriveViewer...');

        try {
            // UI 요소 정의 및 UIManager 초기화
            this.initializeUI();

            // Three.js 객체 초기화
            this.initializeThreeJS();

            // SceneManager 초기화 및 Scene 객체 전달
            this.sceneManager = new SceneManager('viewerContainer', this.logger, this.uiManager);
            this.sceneManager.setScene(this.scene, this.camera, this.renderer, this.controls);
            this.sceneManager.startAnimationLoop();

            // GeometryBuilder 초기화
            this.geometryBuilder = new GeometryBuilder(this.logger, this.scene);
            this.sceneManager.geometryBuilder = this.geometryBuilder;
            
            // 이벤트 리스너 설정
            this.setupEventListeners();

            this.logger.log('OpenDriveViewer Core initialization complete. Now loading WASM.');
            
            // WASM 모듈 초기화
            await this.initializeWasm();
            
            this.logger.log('All initializations are complete.');

        } catch (error) {
            this.logger.error('Failed to initialize OpenDriveViewer:', error);
            console.error('Error stack:', error.stack);
            // UI에 에러 메시지 표시
            if(this.uiManager) {
                this.uiManager.showError('Critical initialization failed: ' + error.message);
            }
        }
    }

    initializeUI() {
        const uiElements = {
            fileInput: document.getElementById('fileInput'),
            loadDefaultBtn: document.getElementById('loadDefaultBtn'),
            toggleReferenceLinesBtn: document.getElementById('toggleReferenceLinesBtn'),
            roadList: document.getElementById('roadList'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            showReferenceLines: document.getElementById('showReferenceLines'),
            showLaneLines: document.getElementById('showLaneLines'),
            showDrivingLanes: document.getElementById('showDrivingLanes'),
            showBorderLanes: document.getElementById('showBorderLanes'),
            showSidewalkLanes: document.getElementById('showSidewalkLanes')
        };
        for (const [key, element] of Object.entries(uiElements)) {
            if (!element) throw new Error(`Required UI element not found: ${key}`);
        }
        this.uiManager = new UIManager(this.logger, uiElements);
    }

    initializeThreeJS() {
        // SceneManager의 컨테이너 가져오기
        const container = document.getElementById('viewerContainer');
        if (!container) throw new Error("Viewer container 'viewerContainer' not found.");

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x202124);

        // Camera (Orthographic)
        const aspect = container.clientWidth / container.clientHeight;
        const viewSize = 100; // 더 넓은 뷰
        this.camera = new THREE.OrthographicCamera(
            -aspect * viewSize / 2, aspect * viewSize / 2,
            viewSize / 2, -viewSize / 2,
            0.1, 20000
        );
        
        // 카메라 위치 설정 (위에서 아래로 보는 뷰)
        this.camera.position.set(0, 100, 0);
        this.camera.lookAt(0, 0, 0);
        this.camera.up.set(0, 0, -1); // Z축이 위쪽을 가리키도록 설정

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Canvas를 SceneManager 컨테이너에 직접 추가
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        
        // OrbitControls 설정
        this.controls.minPolarAngle = 0; // 수직 회전 제한 (위에서 아래로)
        this.controls.maxPolarAngle = Math.PI / 2; // 수평 회전 제한
        this.controls.enableRotate = true;
        this.controls.minZoom = 0.1;
        this.controls.maxZoom = 20;
    }

    async initializeWasm() {
        this.logger.log('Starting WASM module initialization...');
        try {
            // Emscripten Module object. locateFile is crucial for finding the .wasm binary.
            const moduleConfig = {
                locateFile: (path, prefix) => {
                    if (path.endsWith('.wasm')) {
                        this.logger.log(`WASM binary path requested: ${prefix}${path}`);
                        // This path should be relative to the HTML file loading the scripts.
                        return `./OpenDriveWasm.wasm`;
                    }
                    return prefix + path;
                },
                print: (text) => { if (text) this.logger.log(`[WASM] ${text}`); },
                printErr: (text) => { if (text) this.logger.error(`[WASM] ${text}`); },
            };

            // Call the factory function from the Emscripten-generated JS file.
            // It returns a promise that resolves with the module instance.
            this.wasm = await loadWasmModule(moduleConfig);
            this.logger.log('WASM factory function completed, module instance created.');

            // Verify that the exported function 'parseXodr' is available.
            if (typeof this.wasm.parseXodr === 'function') {
                this.logger.log('WASM function "parseXodr" is available.');
            } else {
                 // Emscripten can sometimes hide functions behind cwrap or an underscore.
                 // This provides a fallback if the function isn't directly on the module.
                 this.logger.warn('Direct access to "parseXodr" not found. Attempting fallback with cwrap.');
                 try {
                    // signature: 'name', return type, [arg types]
                    this.wasm.parseXodr = this.wasm.cwrap('parseXodr', 'string', ['string']);
                    this.logger.log('Successfully bound "parseXodr" using cwrap.');
                 } catch(e) {
                     this.logger.error('cwrap failed to bind "parseXodr".', e);
                     throw new Error('WASM module is missing the "parseXodr" function and cwrap fallback failed.');
                 }
            }

            this.logger.log('WASM module is ready to use.');
        } catch (err) {
            this.logger.error('A critical error occurred during WASM initialization.', err);
            console.error('WASM loading error details:', err);
            throw err; // Re-throw to be caught by the outer try-catch in index.html
        }
    }

    setupEventListeners() {
        // 파일 입력 이벤트
        this.uiManager.uiElements.fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.logger.log(`File selected: ${file.name}`);
                this.loadFile(file);
            }
        });

        // 기본 파일 로드 버튼
        this.uiManager.uiElements.loadDefaultBtn.addEventListener('click', async () => {
            this.logger.log('Default load button CLICKED.');
            this.logger.log('Loading default file...');
            await this.loadDefaultFile();
        });

        // Reference 라인 토글
        this.uiManager.uiElements.toggleReferenceLinesBtn.addEventListener('click', () => {
            this.logger.log('Toggling reference lines...');
            this.sceneManager.toggleReferenceLines();
        });

        // 레인 타입 표시 제어
        this.uiManager.uiElements.showDrivingLanes.addEventListener('change', (e) => {
            this.logger.log(`Driving lanes visibility: ${e.target.checked}`);
            this.geometryBuilder.setLaneTypeVisible('driving', e.target.checked);
        });

        this.uiManager.uiElements.showBorderLanes.addEventListener('change', (e) => {
            this.logger.log(`Border lanes visibility: ${e.target.checked}`);
            this.geometryBuilder.setLaneTypeVisible('border', e.target.checked);
        });

        this.uiManager.uiElements.showSidewalkLanes.addEventListener('change', (e) => {
            this.logger.log(`Sidewalk lanes visibility: ${e.target.checked}`);
            this.geometryBuilder.setLaneTypeVisible('sidewalk', e.target.checked);
        });

        // 창 크기 변경 이벤트
        window.addEventListener('resize', () => {
            const container = document.getElementById('viewerContainer');
            if (this.camera && this.renderer && container) {
                const newWidth = container.clientWidth;
                const newHeight = container.clientHeight;
                const aspect = newWidth / newHeight;

                const viewSize = (this.camera.top - this.camera.bottom) * this.camera.zoom;
                this.camera.left = -aspect * viewSize / 2;
                this.camera.right = aspect * viewSize / 2;
                this.camera.top = viewSize / 2;
                this.camera.bottom = -viewSize / 2;

                this.camera.updateProjectionMatrix();
                this.renderer.setSize(newWidth, newHeight);
            }
        });
    }

    async loadFile(file) {
        if (!file) {
            this.logger.error('No file provided to loadFile.');
            return;
        }
        this.uiManager.showLoading(true);
        this.logger.log(`Loading file: ${file.name}...`);

        try {
            const fileContent = await file.text();
            
            if (!this.wasm) {
                throw new Error("WASM module is not initialized. Cannot parse file.");
            }

            this.logger.log('Sending file content to WASM parser...');
            const jsonResult = this.wasm.parseXodr(fileContent);
            this.logger.log('Received JSON from WASM parser.');
            const openDriveData = JSON.parse(jsonResult);
            
            // --- DIAGNOSTIC LOG ---
            // This will log the entire data structure to the developer console.
            // We can inspect this to see why some roads are failing.
            this.logger.log('Full data from WASM parser posted to console.');
            console.log("Full OpenDrive Data Structure:", openDriveData);
            // --- END DIAGNOSTIC LOG ---

            this.sceneManager.clearScene();
            this.uiManager.clearRoadList();

            // 지오메트리 데이터 포함 시 씬에 로드
            if (openDriveData.roads && openDriveData.roads.length > 0) {
                await this.sceneManager.loadOpenDrive(openDriveData);
            }

            // Populate road list if roads array present
            if (openDriveData.roads) {
                this.uiManager.populateRoadList(openDriveData.roads.map(r=>({id:r.id,name:`Road ${r.id}`,length:r.length,status:'basic'})));
            }

            this.uiManager.updateLoadingProgress(100);
            this.uiManager.showLoading(false);

        } catch (error) {
            this.uiManager.showError('Error loading file: ' + error.message);
            this.uiManager.showLoading(false);
        }
    }

    async loadDefaultFile() {
        if (!this.wasm) {
            this.uiManager.showError("WASM module is not ready. Please wait.");
            this.logger.warn("loadDefaultFile called before WASM was ready.");
            return;
        }

        try {
            const response = await fetch('./Germany_2018.xodr');
            const text = await response.text();
            const file = new File([text], 'Germany_2018.xodr', { type: 'text/xml' });
            await this.loadFile(file);
        } catch (error) {
            this.uiManager.showError('Error loading default file: ' + error.message);
        }
    }

    async processInitialData() {
        try {
            // 초기 파싱된 데이터로 씬 구성
            await this.sceneManager.loadOpenDrive(this.initialParsedData);
            this.uiManager.updateLoadingProgress(80);

            // 도로 목록 업데이트
            this.uiManager.populateRoadList(
                this.initialParsedData.roads.map(road => ({
                    id: road.id,
                    name: road.name || `Road ${road.id}`,
                    length: road.length,
                    status: 'basic'
                }))
            );
            this.uiManager.updateLoadingProgress(100);
            this.uiManager.showLoading(false);

        } catch (error) {
            this.uiManager.showError('Error processing data: ' + error.message);
            this.uiManager.showLoading(false);
        }
    }

    async processRoadDetails(roadDetails) {
        try {
            // 도로 상세 정보 처리
            await this.sceneManager.updateRoadDetails(roadDetails);
        } catch (error) {
            this.logger.error('Error processing road details:', error);
        }
    }

    async handleRoadFocus(roadId) {
        this.logger.log(`MainController: Request to focus on road ID: ${roadId}`);
        
        const roadObjectRefName = `road_ref_group_${roadId}`;
        const roadObjectLanesName = `road_${roadId}_lanes`; // GeometryBuilder.js에서 이렇게 생성됨

        // 1. 씬에 이미 해당 도로 객체가 있는지 확인 (참조선 그룹 우선, 없으면 차선 그룹)
        let existingObjectName = null;
        if (this.sceneManager.scene.getObjectByName(roadObjectRefName)) {
            existingObjectName = roadObjectRefName;
        } else if (this.sceneManager.scene.getObjectByName(roadObjectLanesName)) {
            existingObjectName = roadObjectLanesName;
        }

        if (existingObjectName) {
            this.logger.log(`MainController: Road object '${existingObjectName}' for ID ${roadId} already in scene. Focusing.`);
            if (this.sceneManager && typeof this.sceneManager.focusOnRoadObject === 'function') {
                this.sceneManager.focusOnRoadObject(existingObjectName);
            } else {
                this.logger.error("MainController: SceneManager or focusOnRoadObject method not available for existing object.");
            }
            return;
        }

        // 2. 씬에 객체가 없다면, 로드되지 않았거나 상세 파싱이 필요한 상태.
        this.logger.log(`MainController: Road object for ID ${roadId} not found in scene. Attempting to load/render.`);
        const roadData = this.initialParsedRoadsData?.roads.find(r => r.id === roadId);

        if (!roadData) {
            this.logger.warn(`MainController: Road ID ${roadId} not found in initial parsed data for focus.`);
            this.uiManager.showError(`Road ${roadId} not found.`);
            return;
        }

        this.uiManager.updateRoadStatusInList(roadId, 'loading', roadData.name, roadData.length);
        this.uiManager.showLoading(true);

        try {
            let detailedRoad = roadData;
            if (roadData.needsDetails) {
                if (roadData.rawRoadElementContent) {
                    this.logger.log(`MainController: Road ${roadId} needs details. Parsing now...`);
                    detailedRoad = this.parser.parseRoadDetails(roadData);
                    if (!detailedRoad || detailedRoad.needsDetails) {
                        throw new Error(`Failed to parse details for road ${roadId}.`);
                    }
                    this.logger.log(`MainController: Successfully parsed details for road ${roadId}.`);
                    
                    const roadIndex = this.initialParsedRoadsData.roads.findIndex(r => r.id === roadId);
                    if (roadIndex !== -1) {
                        this.initialParsedRoadsData.roads[roadIndex] = detailedRoad;
                    }
                } else {
                    throw new Error(`Road ${roadId} needs details but has no raw content.`);
                }
            }

            // 기존 객체 제거 (SceneManager의 addRoad는 이름을 기준으로 덮어쓰지 않으므로 중복 방지)
            this.sceneManager.removeObjectByName(roadObjectRefName); 
            this.sceneManager.removeObjectByName(roadObjectLanesName); 

            this.logger.log(`MainController: Building geometry for road ID ${roadId} (on-demand focus).`);
            const builtRefLineData = this.geometryBuilder.buildRoadReferenceLines(detailedRoad, detailedRoad.id);
            let finalObjectNameToFocus = null;

            if (builtRefLineData && builtRefLineData.roadLineGroup) {
                // GeometryBuilder에서 roadLineGroup.name을 'road_ref_group_ID'로 설정함
                this.sceneManager.addRoad(detailedRoad.id, builtRefLineData.roadLineGroup); 
                finalObjectNameToFocus = builtRefLineData.roadLineGroup.name; // 'road_ref_group_ID'
                
                if (builtRefLineData.referencePoints && builtRefLineData.referencePoints.length > 0) {
                    const laneMeshesGroup = this.geometryBuilder.buildLaneGeometries(detailedRoad, builtRefLineData.referencePoints, this.activeLaneTypes);
                    // GeometryBuilder에서 laneMeshesGroup.name을 'road_ID_lanes'로 설정함
                    if (laneMeshesGroup && laneMeshesGroup.children.length > 0) {
                        this.sceneManager.addRoad(`${detailedRoad.id}_lanes`, laneMeshesGroup);
                        // 참조선이 있다면 참조선 그룹에 포커스, 없다면 차선 그룹에 포커스 할 수도 있음
                        // 여기서는 참조선 그룹이 항상 생성된다고 가정하고 위에서 설정한 finalObjectNameToFocus 사용
                    }
                }
                this.uiManager.updateRoadStatusInList(roadId, 'loaded', detailedRoad.name, detailedRoad.length);
            } else {
                throw new Error(`Failed to build reference lines for road ${roadId}.`);
            }

            if (finalObjectNameToFocus) {
                this.logger.log(`MainController: Successfully loaded and added road ${roadId}. Focusing on '${finalObjectNameToFocus}'.`);
                if (this.sceneManager && typeof this.sceneManager.focusOnRoadObject === 'function') {
                    this.sceneManager.focusOnRoadObject(finalObjectNameToFocus);
                } else {
                     this.logger.error("MainController: SceneManager or focusOnRoadObject method not available for newly loaded object.");
                }
            } else {
                this.logger.error(`MainController: Road ${roadId} geometry might have been built, but target name for focus is null.`);
            }

        } catch (error) {
            this.logger.error(`MainController: Error loading/rendering road ${roadId} for focus:`, error);
            this.uiManager.showError(`Failed to load/focus road ${roadId}: ${error.message}`);
            this.uiManager.updateRoadStatusInList(roadId, 'error', roadData.name, roadData.length);
        } finally {
            this.uiManager.showLoading(false);
        }
    }

    async loadRemainingRoadsSequentially(startIndex = 0) {
        if (!this.initialParsedRoadsData || !this.initialParsedRoadsData.roads) {
            this.logger.warn("SequentialLoad: No initial parsed road data available.");
            return;
        }

        let roadsProcessedInThisChunk = 0;
        const roadsToProcessPerChunk = 1; // Process one road per call to yield to main thread
        const updatedRoadsInChunk = []; 

        for (let i = startIndex; i < this.initialParsedRoadsData.roads.length; i++) {
            const road = this.initialParsedRoadsData.roads[i];
            let currentRoadStatus = 'loaded'; 
            let detailedRoadForUI = null;

            // Log road's initial plan view coordinates before processing
            if (road && road.planView && road.planView.geometries && road.planView.geometries.length > 0) {
                const firstGeom = road.planView.geometries[0];
                this.logger.log(`SequentialLoad: Road ID ${road.id} (index ${i}), Initial Coords (x,y,hdg,len): (${firstGeom.x?.toFixed(2)}, ${firstGeom.y?.toFixed(2)}, ${firstGeom.hdg?.toFixed(4)}, ${firstGeom.length?.toFixed(2)})`);
            } else if (road) {
                this.logger.log(`SequentialLoad: Road ID ${road.id} (index ${i}) has no planView geometries to log initial coords.`);
            }

            if (road.needsDetails && road.rawRoadElementContent) {
                this.logger.log(`SequentialLoad: Processing road ID: ${road.id} (index ${i})`);
                // Optional: Update UI to 'loading' status immediately if desired, but can be costly.
                // this.uiManager.updateRoadStatusInList(road.id, 'loading'); 
                try {
                    const detailedRoad = this.parser.parseRoadDetails(road);
                    if (detailedRoad && !detailedRoad.needsDetails) {
                        detailedRoadForUI = detailedRoad;
                        // Pass activeLaneTypes for sequential build of roads
                        const roadData = this.geometryBuilder.buildRoadReferenceLines(detailedRoad, detailedRoad.id);
                        if (roadData && roadData.roadLineGroup) {
                            this.sceneManager.addRoad(detailedRoad.id, roadData.roadLineGroup);
                            if (roadData.referencePoints && roadData.referencePoints.length > 0) {
                                const laneMeshes = this.geometryBuilder.buildLaneGeometries(detailedRoad, roadData.referencePoints, this.activeLaneTypes);
                                if (laneMeshes && laneMeshes.children.length > 0) {
                                    this.sceneManager.addRoad(`${detailedRoad.id}_lanes`, laneMeshes);
                                }
                            }
                            this.initialParsedRoadsData.roads[i] = detailedRoad;
                            this.logger.log(`SequentialLoad: Successfully loaded and rendered road ID: ${detailedRoad.id}`);
                            currentRoadStatus = 'loaded';
                        } else {
                            this.logger.warn(`SequentialLoad: Failed to build geometry for road ID: ${detailedRoad.id}.`);
                            this.initialParsedRoadsData.roads[i].needsDetails = false; 
                            currentRoadStatus = 'error'; 
                        }
                    } else {
                        this.logger.warn(`SequentialLoad: Failed to parse details for road ID: ${road.id}.`);
                        this.initialParsedRoadsData.roads[i].needsDetails = false; 
                        currentRoadStatus = 'error';
                    }
                } catch (error) {
                    this.logger.error(`SequentialLoad: Error processing road ID: ${road.id}`, error);
                    this.initialParsedRoadsData.roads[i].needsDetails = false; 
                    currentRoadStatus = 'error';
                }
                
                updatedRoadsInChunk.push({
                    id: road.id, 
                    status: currentRoadStatus, 
                    name: detailedRoadForUI?.name, 
                    length: detailedRoadForUI?.length
                });

                roadsProcessedInThisChunk++;
                if (roadsProcessedInThisChunk >= roadsToProcessPerChunk) {
                    updatedRoadsInChunk.forEach(r => {
                        this.uiManager.updateRoadStatusInList(r.id, r.status, r.name, r.length);
                    });
                    updatedRoadsInChunk.length = 0; // Clear for next chunk

                    this.logger.log(`SequentialLoad: Pausing after road ID: ${road.id}. Will resume from index ${i + 1}`);
                    setTimeout(() => this.loadRemainingRoadsSequentially(i + 1), 0); 
                    return;
                }
            } else if (road.needsDetails && !road.rawRoadElementContent) {
                 this.logger.warn(`SequentialLoad: Road ID: ${road.id} needs details but has no raw content. Skipping.`);
                 this.initialParsedRoadsData.roads[i].needsDetails = false; 
                 updatedRoadsInChunk.push({id: road.id, status: 'error', name: road.name, length: road.length}); 
            }
        }

        // Process any remaining updates in the last chunk if the loop finishes
        if (updatedRoadsInChunk.length > 0) {
            updatedRoadsInChunk.forEach(r => {
                this.uiManager.updateRoadStatusInList(r.id, r.status, r.name, r.length);
            });
        }

        this.logger.log("SequentialLoad: All roads have been processed.");
        // No need to populateRoadList again, as individual items are updated.
    }

    handleLaneTypeFilterChange(selectedTypes) {
        this.logger.log("MainController: Lane type filter changed. Selected types:", selectedTypes);
        this.activeLaneTypes = selectedTypes;

        if (!this.sceneManager) {
            this.logger.error("MainController: SceneManager not available in handleLaneTypeFilterChange.");
            return;
        }

        this.allVisibleLaneTypes.forEach(laneType => {
            if (this.activeLaneTypes.includes(laneType)) {
                this.sceneManager.setLaneTypeVisibility(laneType, true);
            } else {
                this.sceneManager.setLaneTypeVisibility(laneType, false);
            }
        });
    }

    handleGridToggle(visible) {
        this.logger.log(`MainController: Grid toggle changed to ${visible}`);
        if (this.sceneManager) {
            this.sceneManager.setGridVisible(visible);
        }
    }

    /**
     * Rerenders all roads. Currently NOT used for live filter changes due to performance.
     * Might be used for full scene refresh or initial load variations if needed.
     */
    rerenderAllRoadsWithFilter() {
        this.logger.log("MainController: Rerendering all roads with current lane type filter:", this.activeLaneTypes);
        if (!this.initialParsedRoadsData || !this.initialParsedRoadsData.roads) {
            this.logger.warn("MainController: No road data available to rerender.");
            return;
        }

        this.sceneManager.clearScene(false); // Clear only roads, not grid/ego etc.
        // This assumes clearScene(false) will selectively remove road/lane meshes.
        // If not, a more specific removal (e.g., by userData.type) is needed.
        // For simplicity in this step, we might just clear everything and re-add ego if it exists.
        // Let's refine clearScene or add a removeAllRoadMeshes to SceneManager later.

        // Re-add Ego vehicle if it exists, as clearScene might remove it
        if (this.egoVehicleInfo) {
            this.sceneManager.addEgoVehicle(this.egoVehicleInfo);
            this.logger.log("MainController: Ego vehicle re-added after scene clear for re-render.");
        }

        this.initialParsedRoadsData.roads.forEach(road => {
            if (road && !road.needsDetails) { // Only re-render already fully parsed roads
                const roadData = this.geometryBuilder.buildRoadReferenceLines(road, road.id);
                if (roadData && roadData.roadLineGroup) {
                    this.sceneManager.addRoad(road.id, roadData.roadLineGroup);
                    if (roadData.referencePoints && roadData.referencePoints.length > 0) {
                        // Pass the activeLaneTypes to buildLaneGeometries
                        const laneMeshesGroup = this.geometryBuilder.buildLaneGeometries(road, roadData.referencePoints, this.activeLaneTypes);
                        if (laneMeshesGroup && laneMeshesGroup.children.length > 0) {
                            this.sceneManager.addRoad(`${road.id}_lanes`, laneMeshesGroup);
                        }
                    }
                }
            } else if (road && road.needsDetails) {
                // For roads not yet detailed, their initial rendering (or sequential loading)
                // will handle them. Or, we could choose to detail and render them here too.
                // For now, we focus on re-rendering what was already detailed and shown.
                this.logger.log(`MainController: Skipping re-render for road ${road.id} as it needs details or was not rendered.`);
            }
        });

        this.logger.log("MainController: Finished rerendering roads with filter.");
        // Optionally, re-focus camera if needed, e.g., focus on ego or fit all.
        if (this.egoVehicleInfo && this.sceneManager.egoVehicleObject) {
            this.sceneManager.focusEgoTopDownView(); 
        }
    }

    initControls() {
        // Reference 라인 표시 제어
        document.getElementById('showReferenceLines').addEventListener('change', (e) => {
            this.geometryBuilder.setReferenceLinesVisible(e.target.checked);
        });

        // 레인 라인 표시 제어
        document.getElementById('showLaneLines').addEventListener('change', (e) => {
            this.geometryBuilder.setLaneLinesVisible(e.target.checked);
        });

        // 레인 타입별 표시 제어
        document.getElementById('showDrivingLanes').addEventListener('change', (e) => {
            this.geometryBuilder.setLaneTypeVisible('driving', e.target.checked);
        });

        document.getElementById('showBorderLanes').addEventListener('change', (e) => {
            this.geometryBuilder.setLaneTypeVisible('border', e.target.checked);
        });

        document.getElementById('showSidewalkLanes').addEventListener('change', (e) => {
            this.geometryBuilder.setLaneTypeVisible('sidewalk', e.target.checked);
        });
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.renderer.render(this.scene, this.camera);
    }
}

// For non-module usage in browser
// window.OpenDriveViewer = OpenDriveViewer; 
export default OpenDriveViewer; 