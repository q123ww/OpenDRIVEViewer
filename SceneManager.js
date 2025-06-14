import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { DebugLogger } from './DebugLogger.js';

export class SceneManager {
    constructor(containerId, logger, uiManager) {
        this.logger = logger || console;
        this.logger.log(`SceneManager: Constructor called with containerId: ${containerId}.`);
        this.uiManager = uiManager;
        
        // 의존성 주입을 통해 설정될 속성들
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // 내부 관리 객체
        this.egoVehicleObject = null;
        this.roadContainer = new THREE.Group();
        this.animationFrameId = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.intersectedObject = null;
        this.originalMaterial = null;
        this.stats = null;
        this.referenceLinesVisible = false;
        this.lastLodUpdate = 0;
        this.lodUpdateInterval = 1000;

        try {
            this.container = document.getElementById(containerId);
            if (!this.container) {
                throw new Error(`SceneManager critical error: Container element '${containerId}' not found.`);
            }
            this.logger.log("SceneManager: Container element retrieved successfully.");
        } catch (error) {
            this.logger.error("SceneManager: Error during constructor:", error.message, error.stack);
            throw error;
        }
    }

    setScene(scene, camera, renderer, controls) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;

        this.logger.log("SceneManager: Scene, camera, renderer, and controls have been set.");
        this.setupScene();
    }

    setupScene() {
        this.logger.log("SceneManager: Setting up scene additions (road container, stats, listeners)...");
        
        if (!this.scene) {
            this.logger.error("SceneManager: Scene object is not set before setupScene call.");
            return;
        }

        this.scene.add(this.roadContainer);
        
        this.initializeStats();
        this.setupEventListeners();

        this.logger.log("SceneManager: Scene setup completed.");
    }

    initializeScene() {
        this.logger.log("SceneManager: Initializing scene...");
        
        // THREE.js 초기화는 OpenDriveViewer에서 수행하므로 여기서는 생략
        this.roadContainer = new THREE.Group();
        this.scene.add(this.roadContainer);

        // 이벤트 리스너 설정
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.setupEventListeners();

        // FPS Stats 초기화
        this.initializeStats();

        this.logger.log("SceneManager: Scene initialization completed.");
    }

    setupEventListeners() {
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false);
            this.renderer.domElement.addEventListener('mouseleave', this.onMouseLeave.bind(this), false);
            this.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this), false);
            this.logger.log("SceneManager: Mouse event listeners added.");
        }
    }

    initializeStats() {
        this.stats = new Stats();
        this.container.appendChild(this.stats.dom);
        this.stats.dom.style.position = 'absolute';
        this.stats.dom.style.left = '0px';
        this.stats.dom.style.bottom = '10px';
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
        // 이 로직은 OpenDriveViewer.js에서 중앙 관리합니다.
        this.logger.log("SceneManager: Resize event noted, but handled by OpenDriveViewer.");
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
                try {
                    this.stats.update(); // FPS 업데이트
                } catch (e) {
                    if (!this._statsErrorLogged) {
                        this.logger.warn('Stats update error (silenced further):', e.message);
                        this._statsErrorLogged = true; // 한 번만 로그
                    }
                }
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
        this.logger.log(`SceneManager: Adding road mesh for ID: ${roadId}. Mesh Name: ${roadMesh.name}, Mesh UUID: ${roadMesh.uuid}`);
        if (!roadId || !roadMesh) {
            this.logger.error("SceneManager: roadId or roadMesh is null/undefined. Cannot add road.");
            return;
        }
        if (!(roadMesh instanceof THREE.Object3D)) {
            this.logger.error("SceneManager: roadMesh is not an instance of THREE.Object3D. Cannot add to scene. Type:", typeof roadMesh, roadMesh);
            return;
        }

        roadMesh.visible = true;
        this.roadContainer.add(roadMesh);
        this.logger.log(`SceneManager: Mesh ${roadMesh.name} (ID: ${roadId}) ADDED to roadContainer. roadContainer children: ${this.roadContainer.children.length}. Mesh visibility: ${roadMesh.visible}`);
    
        if (roadMesh.name && roadMesh.name.includes('_ref_group_')) {
            this.logger.log(`  Iterating children of reference group: ${roadMesh.name}`);
            if (roadMesh.children.length === 0) {
                this.logger.log(`    Reference group ${roadMesh.name} has NO children when added to scene.`);
            }
            roadMesh.children.forEach((child, index) => {
                this.logger.log(`    Ref Line Child in Scene[${index}]: Name: ${child.name}, Visible: ${child.visible}, userData.type: ${child.userData?.type}, UUID: ${child.uuid}`);
            });
        }
    }
    
    removeObjectByName(name) {
        this.logger.log(`SceneManager: Attempting to remove object by name: ${name}`);
        const objectToRemove = this.roadContainer.getObjectByName(name);
        if (objectToRemove) {
            this.roadContainer.remove(objectToRemove);
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
        if (this.roadContainer) {
            this.logger.log(`SceneManager: roadContainer found. Children count before clearing: ${this.roadContainer.children.length}`);
            while (this.roadContainer.children.length > 0) {
                const child = this.roadContainer.children[0];
                this.roadContainer.remove(child);
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
        
        if (this.egoVehicleObject) {
            this.scene.remove(this.egoVehicleObject);
            if (this.egoVehicleObject.geometry) this.egoVehicleObject.geometry.dispose();
            if (this.egoVehicleObject.material) this.egoVehicleObject.material.dispose();
            this.egoVehicleObject = null;
            this.logger.log("SceneManager: Ego vehicle removed from scene.");
        }

        this.logger.log("SceneManager: clearScene() finished.");
    }

    updateCameraToFitAllRoads() {
        this.logger.log("SceneManager: updateCameraToFitAllRoads() called.");
        if (this.roadContainer.children.length === 0) {
            this.logger.log("SceneManager: No roads in scene to fit camera.");
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

        const aboveHeight = Math.max(size.x, size.z) * 0.5 + 10;
        this.camera.position.set(center.x, aboveHeight, center.z);
        this.camera.lookAt(center);

        const maxDim = Math.max(size.x, size.z);
        this.camera.near = 0.1;
        this.camera.far = aboveHeight + maxDim * 2;

        if (this.camera instanceof THREE.OrthographicCamera) {
            const viewWidth  = this.camera.right - this.camera.left;
            const viewHeight = this.camera.top - this.camera.bottom;

            const requiredWidth  = size.x * padding;
            const requiredHeight = size.z * padding;

            const zoomX = viewWidth  / requiredWidth;
            const zoomY = viewHeight / requiredHeight;

            let newZoom = Math.min(zoomX, zoomY);
            const MIN_ZOOM = 0.0005;
            if (!Number.isFinite(newZoom) || newZoom < MIN_ZOOM) newZoom = MIN_ZOOM;

            this.camera.zoom = newZoom;

            if (this.controls) {
                this.controls.minZoom = newZoom * 0.5;
                this.controls.maxZoom = newZoom * 200;
            }

            this.camera.updateProjectionMatrix();
        }
        this.camera.updateProjectionMatrix();

        if (this.controls) {
            this.controls.target.copy(center);
            this.controls.update();
        }

        const gridSpacing = 100;
        const gridSize = Math.ceil(Math.max(size.x, size.z) / gridSpacing) * gridSpacing;
        const divisions = Math.min(200, gridSize / gridSpacing);
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
        }
        this.gridHelper = new THREE.GridHelper(gridSize, divisions, 0x888888, 0xcccccc);
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

            const padding = 1.1;
            const worldWidth = size.x * padding;
            const worldHeight = size.z * padding;
            
            this.camera.position.set(center.x, center.y + Math.max(worldWidth, worldHeight) * 0.5 + 10, center.z);
            this.camera.lookAt(center.x, center.y, center.z);

            const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
            const camViewWidth = this.camera.right - this.camera.left;
            const camViewHeight = this.camera.top - this.camera.bottom;

            const zoomX = camViewWidth / worldWidth;
            const zoomZ = camViewHeight / worldHeight;
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

    onMouseMove(event) {
        if (!this.renderer || !this.camera || !this.roadContainer) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.roadContainer.children, true);

        if (intersects.length > 0) {
            const firstIntersected = intersects[0].object;
            if (firstIntersected.userData && firstIntersected.userData.roadId) {
                if (this.intersectedObject !== firstIntersected) {
                    if (this.intersectedObject && this.originalMaterial) {
                        this.intersectedObject.material = this.originalMaterial;
                        this.originalMaterial = null;
                    }
                    this.intersectedObject = firstIntersected;
                    if (this.intersectedObject.material) {
                        this.originalMaterial = this.intersectedObject.material;
                        if (this.intersectedObject.material instanceof THREE.LineBasicMaterial) {
                            const highlightMaterial = this.intersectedObject.material.clone();
                            highlightMaterial.color.set(0xff0000);
                            this.intersectedObject.material = highlightMaterial;
                        }
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
                        this.uiManager.showTooltip(tooltipText, event.clientX + 10, event.clientY + 10, this.intersectedObject.userData);
                    }

                } else {
                     if (this.uiManager && this.intersectedObject && this.intersectedObject.userData.roadId) {
                         this.uiManager.updateTooltipPosition(event.clientX + 10, event.clientY + 10);
                     }
                }
            } else {
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

        this.egoVehicleObject.position.set(egoInfo.x, egoInfo.z + 1, -egoInfo.y);
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
            currentEgoPosThreeJs = new THREE.Vector3(egoInfo.x, egoInfo.z + 1, -egoInfo.y);
            currentEgoHeading = egoInfo.heading;
        } else if (this.egoVehicleObject) {
            this.logger.log("SceneManager: egoInfo not provided, focusing on existing egoVehicleObject.");
            currentEgoPosThreeJs = this.egoVehicleObject.position.clone();
            currentEgoHeading = -this.egoVehicleObject.rotation.y;
        } else {
            this.logger.error("SceneManager: focusOnEgoVehicle called without egoInfo and no existing egoVehicleObject.");
            return;
        }
    
        this.camera.lookAt(currentEgoPosThreeJs); 
    
        const offsetDistance = 50;
        const offsetHeight = 25;
    
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
        const egoPosition = new THREE.Vector3(0, 0, 0);
        
        this.camera.position.set(egoPosition.x, egoPosition.y + 50, egoPosition.z);
        this.camera.lookAt(egoPosition);
        this.camera.zoom = 1;
        const aspect = (this.canvas.clientWidth > 0 && this.canvas.clientHeight > 0) ? this.canvas.clientWidth / this.canvas.clientHeight : 1;
        const viewSize = 20;
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
            if (this.uiManager) {
                this.uiManager.showError("Ego vehicle not loaded. Cannot focus top-down view.");
            }
            return;
        }

        const egoPosition = this.egoVehicleObject.position.clone();

        this.camera.position.set(egoPosition.x, egoPosition.y + 50, egoPosition.z);
        this.camera.lookAt(egoPosition);
        this.camera.zoom = 1;
        
        const aspect = (this.canvas.clientWidth > 0 && this.canvas.clientHeight > 0) ? this.canvas.clientWidth / this.canvas.clientHeight : 1;
        const viewSize = 20;

        this.camera.left = -aspect * viewSize / (2 * this.camera.zoom);
        this.camera.right = aspect * viewSize / (2 * this.camera.zoom);
        this.camera.top = viewSize / (2 * this.camera.zoom);
        this.camera.bottom = -viewSize / (2 * this.camera.zoom);
        
        this.camera.updateProjectionMatrix();

        if (this.controls) {
            this.controls.target.copy(egoPosition);
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
        const newState = !this.referenceLinesVisible;
        this.setReferenceLinesVisible(newState);
        this.logger.log(`SceneManager: Reference lines visibility toggled to ${newState}`);
    }

    update() {
        const now = Date.now();
        if (now - this.lastLodUpdate > this.lodUpdateInterval) {
            this.updateLod();
            this.lastLodUpdate = now;
            this.updateRoadVisibility();
        }
    }

    updateLod() {
        const cameraPosition = this.camera.position;
        this.scene.traverse((object) => {
            if (object.userData.type === 'road') {
                const distance = cameraPosition.distanceTo(object.position);
                if (this.geometryBuilder) {
                    this.geometryBuilder.updateLodLevel(distance);
                }
            }
        });
    }

    updateRoadVisibility() {
        if (!this.camera || !this.roadContainer) return;

        this.camera.updateMatrix();
        this.camera.updateMatrixWorld();
        const frustum = new THREE.Frustum();
        const projScreenMatrix = new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);

        let visibleCount = 0;
        this.roadContainer.children.forEach(child => {
            if (!child.userData || child.userData.type !== 'roadLine') {
                return;
            }

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
        this.logger.log(`SceneManager: Loading OpenDRIVE data with ${openDriveData.roads.length} roads.`);
        this.clearScene(); // 기존 도로 지우기

        if (!this.geometryBuilder) {
            this.logger.error("SceneManager: GeometryBuilder is not initialized!");
            return;
        }

        const roadsToProcess = openDriveData.roads || [];
        let roadsAdded = 0;

        for (const roadData of roadsToProcess) {
            try {
                // 도로 참조선(중심선) 메시 생성
                const roadMesh = this.geometryBuilder.createRoadSegmentMesh(roadData);
                if (roadMesh) {
                    this.addRoad(roadData.id, roadMesh);
                    roadsAdded++;
                }

                // 여기에 차선, 표지판 등 다른 요소들을 빌드하는 로직을 추가할 수 있습니다.
                // 예: const laneGroup = this.geometryBuilder.buildLaneMeshes(roadData);
                // if (laneGroup) this.roadContainer.add(laneGroup);

            } catch (error) {
                this.logger.error(`Failed to process road ${roadData.id}:`, error);
            }
        }
        
        this.logger.log(`SceneManager: Finished loading roads. Added ${roadsAdded} road meshes.`);
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