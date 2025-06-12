import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { DebugLogger } from './DebugLogger.js';

export class SceneManager {
    constructor(containerId, logger, uiManager) {
        this.logger = logger || console;
        this.logger.log(`SceneManager: Constructor called with containerId: ${containerId}.`);
        this.uiManager = uiManager;
        this.egoVehicleObject = null; // Ego vehicle 3D object

        try {
            this.container = document.getElementById(containerId);
            if (!this.container) {
                this.logger.error(`SceneManager: Container element not found with ID: '${containerId}'.`);
                throw new Error(`SceneManager critical error: Container element '${containerId}' not found.`);
            }
            this.logger.log("SceneManager: Container element retrieved successfully.");

            // Canvas 요소를 동적으로 생성
            this.canvas = document.createElement('canvas');
            this.container.appendChild(this.canvas); // 컨테이너에 canvas 추가
            this.logger.log("SceneManager: Canvas element created and appended to container.");

            // 캔버스 크기를 컨테이너에 맞춤 (CSS로도 설정 가능)
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            // renderer.setSize는 실제 픽셀 크기를 설정하므로, clientWidth/Height 사용

            this.scene = new THREE.Scene();
            this.logger.log("SceneManager: THREE.Scene created.");

            const canvasWidth = this.canvas.clientWidth;
            const canvasHeight = this.canvas.clientHeight;
            this.logger.log(`SceneManager: Canvas dimensions for camera: ${canvasWidth}x${canvasHeight}`);
            if (canvasWidth === 0 || canvasHeight === 0) {
                this.logger.warn(`SceneManager: Canvas dimensions are zero at camera setup. Ensure container is visible and has dimensions.`);
            }
            
            // OrthographicCamera로 변경
            const aspect = (canvasWidth > 0 && canvasHeight > 0) ? canvasWidth / canvasHeight : 1;
            const viewSize = 20; // 초기 뷰 범위 (가로 또는 세로 중 짧은 쪽 기준 20m)
            this.camera = new THREE.OrthographicCamera(
                -aspect * viewSize / 2, // left
                 aspect * viewSize / 2, // right
                 viewSize / 2,          // top
                -viewSize / 2,          // bottom
                0.1,                    // near
                20000                   // far
            );
            this.logger.log("SceneManager: THREE.OrthographicCamera created.");

            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
            this.logger.log("SceneManager: THREE.WebGLRenderer instance attempted to be created.");
            if (!this.renderer) {
                this.logger.error("SceneManager: Failed to create THREE.WebGLRenderer instance.");
                throw new Error("SceneManager critical error: Failed to create WebGLRenderer.");
            }
            this.logger.log("SceneManager: THREE.WebGLRenderer instance created successfully.");

            this.controls = null;
            this.gridHelper = null;

            this.roadContainer = new THREE.Group(); 
            this.scene.add(this.roadContainer);
            this.logger.log("SceneManager: Road container group created and added to scene.");

            this.animationFrameId = null;

            // Raycasting 관련 초기화
            this.raycaster = new THREE.Raycaster();
            this.mouse = new THREE.Vector2();
            this.intersectedObject = null;
            this.originalMaterial = null; // 하이라이트를 위해 원래 재질 저장

            this.stats = null; // Stats 인스턴스

            this.referenceLinesVisible = false;  // 참조선 기본적으로 숨김

            this.logger.log("SceneManager: SceneManager instance fields initialized.");

            this.lastLodUpdate = 0;
            this.lodUpdateInterval = 1000; // 1초마다 LOD 업데이트

        } catch (error) {
            this.logger.error("SceneManager: Error during constructor execution:", error.message, error.stack);
            throw error; 
        }
        this.logger.log("SceneManager: SceneManager constructor finished successfully.");

        // OrbitControls 추가
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true; // 직교 카메라에서는 true가 더 편리할 수 있음
        // this.controls.minDistance = 10; // Orthographic에서는 zoom으로 제어
        // this.controls.maxDistance = 5000;
        // this.controls.maxPolarAngle = Math.PI / 2; // 기본적으로 위에서만 보도록 유지
        this.controls.enableRotate = true; // 회전은 가능하도록 둠 (필요시 false)
        this.controls.minZoom = 0.1; // 확대 제한
        this.controls.maxZoom = 20;  // 축소 제한

        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        
        // 마우스 이벤트 리스너 등록
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false);
            this.renderer.domElement.addEventListener('mouseleave', this.onMouseLeave.bind(this), false);
            this.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this), false);
            this.logger.log("SceneManager: Mouse event listeners added to renderer.domElement.");
        } else {
            this.logger.error("SceneManager: renderer.domElement not available for adding mouse listeners.");
        }

        // FPS Stats 초기화
        this.stats = new Stats();
        this.container.appendChild(this.stats.dom); // FPS 표시기를 컨테이너에 추가
        this.stats.dom.style.position = 'absolute'; // 다른 UI 요소와 겹치지 않도록
        this.stats.dom.style.left = '0px'; 
        this.stats.dom.style.bottom = '10px'; // top 대신 bottom 사용
        // this.stats.dom.style.top = '0px'; // 기존 top 스타일 제거 또는 주석 처리

        this.logger.log("SceneManager: Scene initialized.");
    }

    initScene() {
        this.logger.log("SceneManager: Initializing scene...");
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x202124, 1); // 파란색이 살짝 도는 검정색 배경

        // 초기 카메라 위치 및 방향 설정 (Bird's Eye View)
        const egoPosition = new THREE.Vector3(0, 0, 0); // Ego 차량 위치 (가정)
        this.camera.position.set(egoPosition.x, egoPosition.y + 50, egoPosition.z); // Y축으로 50만큼 위에서
        this.camera.lookAt(egoPosition); // Ego 차량 위치를 바라봄
        this.camera.zoom = 1; // viewSize가 20일 때, 화면에 20m x (20m*aspect) 영역이 보이도록 함.
        this.camera.updateProjectionMatrix();

        // 조명 추가
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 75);
        this.scene.add(directionalLight);

        // 그리드 추가
        this.gridHelper = new THREE.GridHelper(1000, 50, 0xaaaaaa, 0xdddddd); // 연한 회색으로 변경
        this.scene.add(this.gridHelper);

        if (this.controls) {
            this.controls.target.copy(egoPosition); // 컨트롤의 중심도 Ego 위치로
            this.controls.update();
        }
    }

    onWindowResize() {
        this.logger.log("SceneManager: Window resized.");
        if (this.canvas && this.camera && this.renderer) {
            const newWidth = this.canvas.clientWidth;
            const newHeight = this.canvas.clientHeight; 

            if (newWidth === 0 || newHeight === 0) {
                this.logger.warn("SceneManager: Canvas dimensions are zero, skipping resize.");
                return;
            }

            if (this.camera instanceof THREE.OrthographicCamera) {
                const aspect = newWidth / newHeight;
                // viewSize는 카메라 생성 시 설정한 값을 사용하거나, 현재 카메라 상태에서 역산.
                // 여기서는 생성 시 viewSize와 동일하게 20으로 가정.
                const viewSize = 20; 
                
                // 현재 zoom 레벨을 유지하면서 aspect ratio 변경
                const currentZoom = this.camera.zoom;
                const newViewSizeHeight = viewSize / currentZoom;
                const newViewSizeWidth = newViewSizeHeight * aspect;

                this.camera.left = -newViewSizeWidth / 2;
                this.camera.right = newViewSizeWidth / 2;
                this.camera.top = newViewSizeHeight / 2;
                this.camera.bottom = -newViewSizeHeight / 2;

            } else if (this.camera instanceof THREE.PerspectiveCamera) { // 기존 PerspectiveCamera 코드
                this.camera.aspect = newWidth / newHeight;
            }
            
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(newWidth, newHeight);
            this.logger.log(`SceneManager: Renderer resized to ${newWidth}x${newHeight}`);
        } else {
            this.logger.warn("SceneManager: Resize event triggered but canvas, camera or renderer is not available.");
        }
    }    

    startAnimationLoop() {
        this.logger.log("SceneManager: Starting animation loop.");
        const animate = () => {
            this.animationFrameId = requestAnimationFrame(animate);
            if (this.controls) {
                this.controls.update();
            }
            if (this.renderer && this.scene && this.camera) {
                 this.renderer.render(this.scene, this.camera);
            }
            if (this.stats) {
                this.stats.update(); // FPS 업데이트
            }
        };
        animate();
    }

    stopAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            this.logger.log("SceneManager: Animation loop stopped.");
        }
    }

    addRoad(roadId, roadMesh) {
        this.logger.log(`SceneManager: Adding road mesh for ID: ${roadId}. Mesh Name: ${roadMesh.name}, Mesh UUID: ${roadMesh.uuid}`); // Mesh 정보 추가
        if (!roadId || !roadMesh) {
            this.logger.error("SceneManager: roadId or roadMesh is null/undefined. Cannot add road.");
            return;
        }
        if (!(roadMesh instanceof THREE.Object3D)) {
            this.logger.error("SceneManager: roadMesh is not an instance of THREE.Object3D. Cannot add to scene. Type:", typeof roadMesh, roadMesh);
            return;
        }

        // roadMesh.name = `road_${roadId}`; // OpenDriveViewer에서 이미 그룹에 이름을 설정해서 전달함 (예: road_ref_group_ID, lane_group_ID)
        roadMesh.visible = this.referenceLinesVisible; // 기본 숨김 여부 적용
        this.roadContainer.add(roadMesh);
        this.logger.log(`SceneManager: Mesh ${roadMesh.name} (ID: ${roadId}) ADDED to roadContainer. roadContainer children: ${this.roadContainer.children.length}. Mesh visibility: ${roadMesh.visible}`);
    
        // 참조선 그룹 내부 로깅 추가
        if (roadMesh.name && roadMesh.name.includes('_ref_group_')) { // 또는 userData.type === 'referenceLineGroup' 등 더 명확한 식별자 사용
            this.logger.log(`  Iterating children of reference group: ${roadMesh.name}`);
            if (roadMesh.children.length === 0) {
                this.logger.log(`    Reference group ${roadMesh.name} has NO children when added to scene.`);
            }
            roadMesh.children.forEach((child, index) => {
                this.logger.log(`    Ref Line Child in Scene[${index}]: Name: ${child.name}, Visible: ${child.visible}, userData.type: ${child.userData?.type}, UUID: ${child.uuid}`);
            });
        }
        // 전체 도로 네트워크의 바운딩 박스를 업데이트하고 카메라 조정 (옵션)
        // this.updateCameraToFitAllRoads(); 
    }
    
    removeObjectByName(name) {
        this.logger.log(`SceneManager: Attempting to remove object by name: ${name}`);
        const objectToRemove = this.roadContainer.getObjectByName(name);
        if (objectToRemove) {
            this.roadContainer.remove(objectToRemove);
            // 지오메트리 및 재질 dispose
            if (objectToRemove.geometry) objectToRemove.geometry.dispose();
            if (objectToRemove.material) {
                if (Array.isArray(objectToRemove.material)) {
                    objectToRemove.material.forEach(material => material.dispose());
                } else {
                    objectToRemove.material.dispose();
                }
            }
            this.logger.log(`SceneManager: Successfully removed object: ${name}`);
            return true;
        } else {
            this.logger.warn(`SceneManager: Object with name ${name} not found in roadContainer. Cannot remove.`);
            return false;
        }
    }

    clearScene() {
        this.logger.log("SceneManager: clearScene() called. Attempting to remove all road objects.");
        let removalCount = 0;
        // roadContainer에서 모든 자식 객체 제거
        if (this.roadContainer) {
            this.logger.log(`SceneManager: roadContainer found. Children count before clearing: ${this.roadContainer.children.length}`);
            while (this.roadContainer.children.length > 0) {
                const child = this.roadContainer.children[0];
                this.roadContainer.remove(child);
                // 필요하다면 메쉬의 지오메트리와 재질도 dispose
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
                removalCount++;
                this.logger.log(`SceneManager: Removed child object: ${child.name || 'Unnamed Object'}. Remaining: ${this.roadContainer.children.length}`);
            }
            this.logger.log(`SceneManager: All children removed from roadContainer. Total removed: ${removalCount}`);
        } else {
            this.logger.warn("SceneManager: roadContainer not found during clearScene.");
        }
        
        // Remove Ego vehicle if it exists
        if (this.egoVehicleObject) {
            this.scene.remove(this.egoVehicleObject);
            if (this.egoVehicleObject.geometry) this.egoVehicleObject.geometry.dispose();
            if (this.egoVehicleObject.material) this.egoVehicleObject.material.dispose();
            this.egoVehicleObject = null;
            this.logger.log("SceneManager: Ego vehicle removed from scene.");
        }
        
        // 이전에 추가된 다른 임시 객체들(예: 테스트 큐브)도 여기서 제거해야 할 수 있음
        // 예시: this.scene.remove(this.testCube);

        this.logger.log("SceneManager: clearScene() finished.");
    }

    updateCameraToFitAllRoads() {
        this.logger.log("SceneManager: updateCameraToFitAllRoads() called.");
        if (this.roadContainer.children.length === 0) {
            this.logger.log("SceneManager: No roads in scene to fit camera.");
            // 기본 뷰로 리셋 또는 현재 뷰 유지
            this.camera.position.set(0, 50, 100);
            this.camera.lookAt(0, 0, 0);
            if(this.controls) this.controls.update();
            return;
        }

        const boundingBox = new THREE.Box3().setFromObject(this.roadContainer);
        if (boundingBox.isEmpty()) {
            this.logger.warn("SceneManager: Bounding box of roadContainer is empty. Cannot adjust camera.");
            return;
        }

        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());

        this.logger.log("SceneManager: Road network bounding box calculated.", 
                        `Min: (${boundingBox.min.x.toFixed(2)}, ${boundingBox.min.y.toFixed(2)}, ${boundingBox.min.z.toFixed(2)})`, 
                        `Max: (${boundingBox.max.x.toFixed(2)}, ${boundingBox.max.y.toFixed(2)}, ${boundingBox.max.z.toFixed(2)})`,
                        `Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`,
                        `Size: (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`);

        const padding = 1.1; // 10% 여백

        // 카메라 위치: 상공에서 내려다보도록 Y축 위로 이동, Z는 center.z 유지
        const aboveHeight = Math.max(size.x, size.z) * 0.5 + 10; // 네트워크 크기에 비례한 높이
        this.camera.position.set(center.x, aboveHeight, center.z);
        this.camera.lookAt(center);

        // Orthographic 카메라 zoom 조정
        if (this.camera instanceof THREE.OrthographicCamera) {
            const viewWidth = this.camera.right - this.camera.left;
            const viewHeight = this.camera.top - this.camera.bottom;
            const requiredWidth = size.x * padding;
            const requiredHeight = size.z * padding; // Y 대신 Z 축 사용

            const zoomX = viewWidth / requiredWidth;
            const zoomY = viewHeight / requiredHeight;
            let newZoom = Math.min(zoomX, zoomY);
            const MIN_ZOOM_CAP = 0.001;
            if (newZoom < MIN_ZOOM_CAP) newZoom = MIN_ZOOM_CAP; // 안전 하한

            this.camera.zoom = newZoom;
            // OrbitControls의 zoom 한계도 동적으로 업데이트해 갑작스러운 점프 방지
            if (this.controls) {
                this.controls.minZoom = newZoom * 0.5; // 조금 더 넓게 볼 수 있도록
                this.controls.maxZoom = newZoom * 100; // 충분히 확대 가능
            }
            this.camera.updateProjectionMatrix();
        }

        if (this.controls) {
            this.controls.target.copy(center);
            this.controls.update();
        }

        // 그리드 크기를 네트워크에 맞게 재설정
        const gridSpacing = 100; // 100 m 간격
        const gridSize = Math.ceil(Math.max(size.x, size.z) / gridSpacing) * gridSpacing;
        const divisions = Math.min(200, gridSize / gridSpacing); // 최대 200 division
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
        }
        this.gridHelper = new THREE.GridHelper(gridSize, divisions, 0x888888, 0xcccccc);
        // 더 은은하게: 투명도 낮추기
        if (Array.isArray(this.gridHelper.material)) {
            this.gridHelper.material.forEach(mat => { mat.transparent = true; mat.opacity = 0.15; mat.depthWrite = false; });
        } else {
            this.gridHelper.material.transparent = true;
            this.gridHelper.material.opacity = 0.15;
            this.gridHelper.material.depthWrite = false;
        }
        this.gridHelper.position.set(center.x, 0, center.z);
        this.gridHelper.visible = true;
        this.scene.add(this.gridHelper);

        this.logger.log("SceneManager: Camera adjusted to fit all roads (Orthographic mode).");
    }

    focusOnRoadObject(objectName) {
        this.logger.log(`SceneManager: Attempting to focus on road object: ${objectName}`);
        const roadObject = this.roadContainer.getObjectByName(objectName);

        if (roadObject) {
            this.logger.log(`SceneManager: Found road object: ${objectName}`);
            const boundingBox = new THREE.Box3().setFromObject(roadObject);

            if (boundingBox.isEmpty()) {
                this.logger.warn(`SceneManager: Bounding box for road ${objectName} is empty. Cannot focus.`);
                return;
            }

            const center = boundingBox.getCenter(new THREE.Vector3());
            const size = boundingBox.getSize(new THREE.Vector3());

            this.logger.log(`SceneManager: Bounding box for ${objectName}:`,
                            `Min: (${boundingBox.min.x.toFixed(2)}, ${boundingBox.min.y.toFixed(2)}, ${boundingBox.min.z.toFixed(2)})`,
                            `Max: (${boundingBox.max.x.toFixed(2)}, ${boundingBox.max.y.toFixed(2)}, ${boundingBox.max.z.toFixed(2)})`,
                            `Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`,
                            `Size: (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`);

            const padding = 1.1; // 객체 주변에 약간의 여백 (10%)
            const worldWidth = size.x * padding;
            const worldHeight = size.z * padding; // XZ 평면을 주로 사용하므로 Y 대신 Z 사용
            
            this.camera.position.set(center.x, center.y + Math.max(worldWidth, worldHeight) * 0.5 + 10, center.z); // Y를 약간 높여서 내려다보는 효과, Z는 중심
            this.camera.lookAt(center.x, center.y, center.z);

            // Orthographic 카메라의 Zoom 레벨 조정
            // 화면에 더 넓은 쪽 (width 또는 height)이 꽉 차도록 zoom 값 계산
            const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
            const camViewWidth = this.camera.right - this.camera.left;
            const camViewHeight = this.camera.top - this.camera.bottom;

            const zoomX = camViewWidth / worldWidth;
            const zoomZ = camViewHeight / worldHeight; // 높이를 Z 크기로 계산
            this.camera.zoom = Math.min(zoomX, zoomZ);
            
            this.camera.updateProjectionMatrix();

            if (this.controls) {
                this.controls.target.copy(center);
                this.controls.update();
            }
            this.logger.log(`SceneManager: Camera focused on object: ${objectName}`);
        } else {
            this.logger.warn(`SceneManager: Road object with name ${objectName} not found. Cannot focus.`);
        }
    }

    // Helper for smooth camera animation (requires a library like Tween.js or GSAP)
    /*
    animateCameraTo(targetPosition, targetLookAt) {
        const duration = 1000; // ms
        const currentCamPos = this.camera.position.clone();
        const currentLookAt = this.controls.target.clone();

        new TWEEN.Tween({ p: currentCamPos, l: currentLookAt })
            .to({ p: targetPosition, l: targetLookAt }, duration)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate((obj) => {
                this.camera.position.copy(obj.p);
                this.controls.target.copy(obj.l);
                this.camera.lookAt(obj.l);
            })
            .start();
    }
    */

    // 마우스 이동 이벤트 핸들러
    onMouseMove(event) {
        if (!this.renderer || !this.camera || !this.roadContainer) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.roadContainer.children, true); // true for recursive

        if (intersects.length > 0) {
            const firstIntersected = intersects[0].object;
            // Line 객체만 대상으로 하거나, userData가 있는 객체만 대상으로 할 수 있음
            if (firstIntersected.userData && firstIntersected.userData.roadId) {
                if (this.intersectedObject !== firstIntersected) {
                    // 이전 객체 하이라이트 제거
                    if (this.intersectedObject && this.originalMaterial) {
                        this.intersectedObject.material = this.originalMaterial;
                        this.originalMaterial = null;
                    }
                    this.intersectedObject = firstIntersected;
                    // 새 객체 하이라이트 (색상 변경 예시)
                    if (this.intersectedObject.material) {
                        this.originalMaterial = this.intersectedObject.material;
                        // LineBasicMaterial의 경우, clone 후 color 변경
                        if (this.intersectedObject.material instanceof THREE.LineBasicMaterial) {
                            const highlightMaterial = this.intersectedObject.material.clone();
                            highlightMaterial.color.set(0xff0000); // 빨간색으로 하이라이트
                            this.intersectedObject.material = highlightMaterial;
                        } 
                        // TODO: 다른 타입의 재질에 대한 하이라이트 처리 추가 가능
                    }

                    const hitPt = intersects[0].point;
                    const odrX = hitPt.x.toFixed(1);
                    const odrY = (-hitPt.z).toFixed(1);

                    let tooltipText = `Road ${this.intersectedObject.userData.roadId}`;
                    if (this.intersectedObject.userData.laneId !== undefined) {
                        tooltipText += ` | Lane ${this.intersectedObject.userData.laneId}`;
                    }
                    if (this.intersectedObject.userData.length !== undefined) {
                        tooltipText += ` | Len ${this.intersectedObject.userData.length.toFixed(1)}m`;
                    }
                    if (this.intersectedObject.userData.laneType) {
                        tooltipText += ` (${this.intersectedObject.userData.laneType})`;
                    }
                    tooltipText += `\nX:${odrX}m Y:${odrY}m`;

                    if (this.uiManager) {
                        // Pass basic tooltip text and the full userData for more details
                        this.uiManager.showTooltip(tooltipText, event.clientX + 10, event.clientY + 10, this.intersectedObject.userData);
                    }

                } else { // 동일 객체 위에 마우스가 계속 있는 경우, 툴크 위치만 업데이트
                     if (this.uiManager && this.intersectedObject && this.intersectedObject.userData.roadId) {
                         this.uiManager.updateTooltipPosition(event.clientX + 10, event.clientY + 10);
                     }
                }
            } else { // userData.roadId가 없는 유효한 교차 객체 (예: GridHelper)
                 this.clearIntersected();
            }
        } else {
            this.clearIntersected();
        }
    }

    onMouseLeave(event) {
        this.clearIntersected();
    }

    clearIntersected() {
        if (this.intersectedObject && this.originalMaterial) {
            this.intersectedObject.material = this.originalMaterial;
        }
        this.intersectedObject = null;
        this.originalMaterial = null;
        if (this.uiManager) {
            this.uiManager.hideTooltip();
        }
    }

    addEgoVehicle(egoInfo) {
        this.logger.log("SceneManager: Adding Ego vehicle to scene.", egoInfo);
        if (this.egoVehicleObject) {
            this.scene.remove(this.egoVehicleObject);
            if (this.egoVehicleObject.geometry) this.egoVehicleObject.geometry.dispose();
            if (this.egoVehicleObject.material) this.egoVehicleObject.material.dispose();
            this.egoVehicleObject = null;
            this.logger.log("SceneManager: Removed existing Ego vehicle.");
        }

        if (!egoInfo) {
            this.logger.error("SceneManager: egoInfo is null or undefined. Cannot add Ego vehicle.");
            return;
        }

        const egoGeometry = new THREE.BoxGeometry(4, 2, 2); 
        const egoMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); 
        this.egoVehicleObject = new THREE.Mesh(egoGeometry, egoMaterial);

        // Consistent coordinate transformation:
        // OpenDRIVE X -> Three.js X
        // OpenDRIVE Y -> Three.js -Z
        // OpenDRIVE Z (height) -> Three.js Y
        this.egoVehicleObject.position.set(egoInfo.x, egoInfo.z + 1, -egoInfo.y); // egoInfo.z is height, +1 for box center
        
        // OpenDRIVE hdg is counter-clockwise from positive X-axis.
        // Three.js y-rotation is counter-clockwise around positive Y-axis.
        // Mapping ODR (X,Y) plane to Three.js (X,-Z) plane, a CCW rotation hdg in ODR
        // becomes a CW rotation -hdg around Y in Three.js to achieve the same world orientation.
        this.egoVehicleObject.rotation.y = -egoInfo.heading; 

        this.egoVehicleObject.name = "ego_vehicle";
        this.scene.add(this.egoVehicleObject);
        this.logger.log("SceneManager: Ego vehicle mesh created and added to scene.", 
                        `Position: (${this.egoVehicleObject.position.x.toFixed(2)}, ${this.egoVehicleObject.position.y.toFixed(2)}, ${this.egoVehicleObject.position.z.toFixed(2)})`, 
                        `Rotation Y: ${this.egoVehicleObject.rotation.y.toFixed(2)}`);
    }

    focusOnEgoVehicle(egoInfo) {
        if (!egoInfo && !this.egoVehicleObject) {
            this.logger.warn("SceneManager: No egoInfo and no egoVehicleObject to focus on. Resetting camera to default.");
            this.camera.position.set(0, 50, 100);
            this.camera.lookAt(0, 0, 0);
            if (this.controls) {
                this.controls.target.set(0,0,0);
                this.controls.update();
            }
            return;
        }

        let currentEgoPosThreeJs;
        let currentEgoHeading = 0;

        if (egoInfo) {
            this.logger.log("SceneManager: Focusing camera on Ego vehicle based on new egoInfo.", egoInfo);
            // Use consistent coordinate transformation for the target position
            currentEgoPosThreeJs = new THREE.Vector3(egoInfo.x, egoInfo.z + 1, -egoInfo.y); // +1 for box center y
            currentEgoHeading = egoInfo.heading;
        } else if (this.egoVehicleObject) { // Fallback to existing ego object if no new info
            this.logger.log("SceneManager: egoInfo not provided, focusing on existing egoVehicleObject.");
            currentEgoPosThreeJs = this.egoVehicleObject.position.clone();
            currentEgoHeading = -this.egoVehicleObject.rotation.y; // Infer heading from rotation
        } else {
            // Should have been caught by the first if, but as a safeguard.
            this.logger.error("SceneManager: focusOnEgoVehicle called without egoInfo and no existing egoVehicleObject.");
            return;
        }
    
        this.camera.lookAt(currentEgoPosThreeJs); 
    
        const offsetDistance = 50; // Increased distance for wider view
        const offsetHeight = 25;   // Increased height
    
        // Calculate camera position based on ego's heading in ODR system
        // ODR X-axis -> Three.js X-axis
        // ODR Y-axis -> Three.js -Z-axis
        // Camera behind ego: ODR direction (-cos(hdg), -sin(hdg))
        // camX_three = egoX_three + (-cos(hdg)) * offsetDistance 
        // camZ_three = egoZ_three + (+sin(hdg)) * offsetDistance (because ODR -Y direction is Three +Z direction)
        const camX = currentEgoPosThreeJs.x - offsetDistance * Math.cos(currentEgoHeading);
        const camY = currentEgoPosThreeJs.y + offsetHeight;
        const camZ = currentEgoPosThreeJs.z + offsetDistance * Math.sin(currentEgoHeading); 
    
        this.camera.position.set(camX, camY, camZ);
    
        if (this.controls) {
            this.controls.target.copy(currentEgoPosThreeJs);
            this.controls.update();
            this.logger.log("SceneManager: Camera and controls updated to focus on Ego vehicle.",
                            `Cam Pos: (${camX.toFixed(2)}, ${camY.toFixed(2)}, ${camZ.toFixed(2)})`,
                            `Target: (${currentEgoPosThreeJs.x.toFixed(2)}, ${currentEgoPosThreeJs.y.toFixed(2)}, ${currentEgoPosThreeJs.z.toFixed(2)})`);
        } else {
            this.logger.warn("SceneManager: OrbitControls not available to update target.");
        }
    }

    setLaneTypeVisibility(laneType, visible) {
        this.logger.log(`SceneManager: Setting visibility for lane type '${laneType}' to ${visible}`);
        let objectsChanged = 0;
        this.scene.traverse((object) => {
            if (object.isLine && object.userData) {
                // Check for lane boundaries OR reference lines matching the laneType
                if ((object.userData.type === 'laneBoundary' && object.userData.laneType === laneType) || 
                    (object.userData.type === 'referenceLine' && object.userData.laneType === laneType)) {
                    if (object.visible !== visible) {
                        object.visible = visible;
                        objectsChanged++;
                    }
                }
            }
        });
        if (objectsChanged > 0) {
            this.logger.log(`SceneManager: Changed visibility of ${objectsChanged} objects for lane type '${laneType}'.`);
        } else {
            this.logger.log(`SceneManager: No objects found or visibility already set for lane type '${laneType}'.`);
        }
    }

    setRoadsVisible(visible) {
        this.logger.log(`SceneManager: Setting roads (all visual elements in roadContainer) visibility to ${visible}`);
        if (this.roadContainer) {
            this.roadContainer.visible = visible;
            // Note: This will hide/show everything in roadContainer, including reference lines if they are direct children
            // and not handled separately by setReferenceLinesVisible after this call.
            // If reference lines are part of a sub-group within road meshes, this will toggle the whole road mesh.
        }
    }

    setGridVisible(visible) {
        this.logger.log(`SceneManager: Setting grid visibility to ${visible}`);
        if (this.gridHelper) {
            this.gridHelper.visible = visible;
        }
    }

    resetToInitialView() {
        this.logger.log("SceneManager: Resetting to initial view.");
        const egoPosition = new THREE.Vector3(0, 0, 0); // initScene과 동일한 기준점
        
        this.camera.position.set(egoPosition.x, egoPosition.y + 50, egoPosition.z);
        this.camera.lookAt(egoPosition);
        this.camera.zoom = 1; // initScene과 동일한 줌 값
        // OrthographicCamera의 viewSize를 유지하기 위해 left/right/top/bottom 업데이트 필요
        const aspect = (this.canvas.clientWidth > 0 && this.canvas.clientHeight > 0) ? this.canvas.clientWidth / this.canvas.clientHeight : 1;
        const viewSize = 20; // 초기 viewSize 값 (생성자와 동일하게)
        this.camera.left = -aspect * viewSize / (2 * this.camera.zoom);
        this.camera.right = aspect * viewSize / (2 * this.camera.zoom);
        this.camera.top = viewSize / (2 * this.camera.zoom);
        this.camera.bottom = -viewSize / (2 * this.camera.zoom);
        this.camera.updateProjectionMatrix();

        if (this.controls) {
            this.controls.target.copy(egoPosition);
            this.controls.update();
        }
        this.logger.log("SceneManager: Camera reset to initial view.");
    }

    focusEgoTopDownView() {
        this.logger.log("SceneManager: Attempting to focus on Ego vehicle from top-down.");
        if (!this.egoVehicleObject) {
            this.logger.warn("SceneManager: Ego vehicle not found. Cannot focus top-down view.");
            // Optional: alert or notify user via UIManager
            if (this.uiManager) {
                this.uiManager.showError("Ego vehicle not loaded. Cannot focus top-down view.");
            }
            return;
        }

        const egoPosition = this.egoVehicleObject.position.clone();

        // 카메라 위치: Ego 차량 바로 위 (Y축으로 충분히 높게)
        this.camera.position.set(egoPosition.x, egoPosition.y + 50, egoPosition.z); // 높이는 50으로 설정 (조정 가능)
        this.camera.lookAt(egoPosition); // Ego 차량의 현재 위치를 바라봄

        // Zoom 레벨은 차량 주변이 적절히 보이도록 설정 (2배 넓게)
        // viewSize가 20m일 때, zoom 1이면 짧은 축 기준 20m 영역이 보임.
        this.camera.zoom = 1; // 기졸 zoom = 2 에서 1로 변경하여 보이는 범위 2배 확장
        
        // OrthographicCamera의 경우 zoom 변경 후 projection matrix 업데이트 전에 left/right/top/bottom도 업데이트 필요
        const aspect = (this.canvas.clientWidth > 0 && this.canvas.clientHeight > 0) ? this.canvas.clientWidth / this.canvas.clientHeight : 1;
        const viewSize = 20; // 카메라 생성 시 사용된 viewSize (또는 원하는 기본 시야 크기)

        this.camera.left = -aspect * viewSize / (2 * this.camera.zoom);
        this.camera.right = aspect * viewSize / (2 * this.camera.zoom);
        this.camera.top = viewSize / (2 * this.camera.zoom);
        this.camera.bottom = -viewSize / (2 * this.camera.zoom);
        
        this.camera.updateProjectionMatrix();

        if (this.controls) {
            this.controls.target.copy(egoPosition); // 컨트롤러의 타겟도 Ego 위치로
            this.controls.update();
        }
        this.logger.log("SceneManager: Camera focused on Ego vehicle (Top-Down View).");
    }

    setReferenceLinesVisible(visible) {
        this.referenceLinesVisible = visible;
        this.scene.traverse((object) => {
            if (object.userData.type === 'referenceLine') {
                object.visible = visible;
            }
        });
    }

    toggleReferenceLines() {
        // 현재 가시성 상태를 반전하여 적용
        const newState = !this.referenceLinesVisible;
        this.setReferenceLinesVisible(newState);
        this.logger.log(`SceneManager: Reference lines visibility toggled to ${newState}`);
    }

    update() {
        // ... existing code ...
        
        // LOD 업데이트
        const now = Date.now();
        if (now - this.lastLodUpdate > this.lodUpdateInterval) {
            this.updateLod();
            this.lastLodUpdate = now;

            // 시야 밖 객체 숨김 처리
            this.updateRoadVisibility();
        }
    }

    updateLod() {
        const cameraPosition = this.camera.position;
        this.scene.traverse((object) => {
            if (object.userData.type === 'road') {
                const distance = cameraPosition.distanceTo(object.position);
                // GeometryBuilder에 카메라 거리 전달
                if (this.geometryBuilder) {
                    this.geometryBuilder.updateLodLevel(distance);
                }
            }
        });
    }

    updateRoadVisibility() {
        if (!this.camera || !this.roadContainer) return;

        // 카메라 프러스텀 계산
        this.camera.updateMatrix();
        this.camera.updateMatrixWorld();
        const frustum = new THREE.Frustum();
        const projScreenMatrix = new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);

        let visibleCount = 0;
        this.roadContainer.children.forEach(child => {
            if (!child.userData || child.userData.type !== 'roadLine') {
                // lane groups 포함 기타는 그대로
                return;
            }

            // boundingSphere 계산 (once and cache)
            if (!child.geometry.boundingSphere) {
                child.geometry.computeBoundingSphere();
            }
            const sphere = child.geometry.boundingSphere.clone();
            sphere.applyMatrix4(child.matrixWorld);

            const isIn = frustum.intersectsSphere(sphere);
            child.visible = isIn;
            if (isIn) visibleCount++;
        });
        this.logger.log(`SceneManager: updateRoadVisibility visible road lines: ${visibleCount}/${this.roadContainer.children.length}`);
    }

    async loadOpenDrive(openDriveData) {
        // ... existing code ...
        for (const road of openDriveData.roads) {
            const cameraDistance = this.camera.position.length(); // 임시: 원점 기준 거리
            const roadMesh = this.geometryBuilder.createRoadSegmentMesh(road, cameraDistance);
            if (roadMesh) {
                // addRoad 메서드에서 visibility 설정을 일관되게 처리하므로 여기서는 직접 추가하지 않고 addRoad를 사용합니다.
                this.addRoad(road.id, roadMesh);
            }

            // lane boundaries
            const surfaceMesh = this.geometryBuilder.buildRoadSurfaceMesh(road, cameraDistance);
            if (surfaceMesh) {
                this.roadContainer.add(surfaceMesh);
            }

            const laneGroup = this.geometryBuilder.buildLaneMeshes(road, cameraDistance);
            if (laneGroup) {
                this.roadContainer.add(laneGroup);
            }

            const markGroup = this.geometryBuilder.buildRoadMarkMeshes(road, cameraDistance);
            if (markGroup) this.roadContainer.add(markGroup);
        }
        // ... existing code ...

        // 모든 도로 추가 후 카메라 프레이밍
        this.updateCameraToFitAllRoads();
    }

    onMouseClick(event) {
        if (!this.renderer || !this.camera || !this.roadContainer) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouseNDC = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        this.raycaster.setFromCamera(mouseNDC, this.camera);
        const intersects = this.raycaster.intersectObjects(this.roadContainer.children, true);
        if (intersects.length === 0) return;

        let obj = intersects[0].object;
        // parent traversal to find roadLine
        while (obj && (!obj.userData || !obj.userData.roadId)) {
            obj = obj.parent;
        }
        if (obj && obj.userData && obj.userData.roadId) {
            if (this.uiManager && typeof this.uiManager.showRoadInfo === 'function') {
                const clickPt = intersects[0].point.clone();
                const odrX = clickPt.x;
                const odrY = -clickPt.z;
                this.uiManager.showRoadInfo({
                    roadId: obj.userData.roadId,
                    length: obj.userData.length,
                    laneId: obj.userData.laneId,
                    x: odrX,
                    y: odrY
                });
            }
        }
    }
} 