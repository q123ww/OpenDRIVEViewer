import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js';
import { DebugLogger } from './DebugLogger.js';

// Toggle: if true, zero-width lanes (after clamping) are ignored in cumulative width.
const SKIP_ZERO_WIDTH = true;

export class GeometryBuilder {
    constructor(logger, scene) {
        this.logger = logger;
        this.scene = scene;
        this.logger.log('Initializing GeometryBuilder...');

        // LOD 레벨 정의
        this.lodLevels = {
            level0: { distance: 5, interval: 5.0 },  // 5m 간격
            level1: { distance: 2, interval: 2.0 },  // 2m 간격
            level2: { distance: 1, interval: 1.0 },  // 1m 간격
            level3: { distance: 0.5, interval: 0.5 } // 0.5m 간격
        };

        this.currentLodLevel = 'level0';
        this.logger.log('GeometryBuilder initialization complete');
    }

    createRoadSegmentMesh(road, cameraDistance) {
        try {
            const points = [];
            
            // 각 지오메트리 세그먼트 처리
            for (const geometry of road.planView.geometries) {
                const segmentPoints = this.calculateRoadPoints(geometry);
                if (points.length > 0 && segmentPoints.length > 0) {
                    // 중복 첫 포인트 제거
                    points.push(...segmentPoints.slice(1));
                } else {
                    points.push(...segmentPoints);
                }
            }

            // 버퍼 지오메트리 생성
            const roadGeometry = new THREE.BufferGeometry();
            roadGeometry.setFromPoints(points);

            // 도로 메시 생성
            const roadMaterial = new THREE.LineBasicMaterial({ 
                color: 0xffffff,  // 흰색
                linewidth: 2
            });
            const roadMesh = new THREE.Line(roadGeometry, roadMaterial);
            roadMesh.name = `road_${road.id}`;
            roadMesh.userData = { 
                type: 'roadLine', 
                roadId: road.id, 
                length: road.length 
            };

            return roadMesh;
        } catch (error) {
            this.logger.error(`Error creating road segment mesh for road ${road.id}:`, error);
            throw error;
        }
    }

    updateLodLevel(cameraDistance) {
        // 카메라 거리에 따른 LOD 레벨 결정
        if (cameraDistance >= this.lodLevels.level0.distance) {
            this.currentLodLevel = 'level0';
        } else if (cameraDistance >= this.lodLevels.level1.distance) {
            this.currentLodLevel = 'level1';
        } else if (cameraDistance >= this.lodLevels.level2.distance) {
            this.currentLodLevel = 'level2';
        } else {
            this.currentLodLevel = 'level3';
        }
    }

    calculateRoadPoints(geometry) {
        const points = [];
        const { x, y, hdg, length, type, params = {} } = geometry;

        // 포인트 간격 설정 (도로 길이에 따라 조정)
        const numPoints = Math.max(2, Math.ceil(length / 1.0));  // 1m 간격
        const interval = length / (numPoints - 1);

        for (let i = 0; i < numPoints; i++) {
            const s = i * interval;
            let point;

            switch (type) {
                case 'line':
                    point = this.calculateLinePoint(x, y, hdg, s);
                    break;
                case 'arc': {
                    const curvature = params.curvature || 0;
                    point = this.calculateArcPoint(x, y, hdg, s, curvature);
                    break;
                }
                case 'spiral': {
                    const curvStart = params.curvStart || 0;
                    const curvEnd = params.curvEnd || 0;
                    point = this.calculateSpiralPoint(x, y, hdg, s, curvStart, curvEnd, length);
                    break;
                }
                default:
                    this.logger.warn(`Unsupported geometry type: ${type}`);
                    continue;
            }

            if (point && Number.isFinite(point.x)) {
                points.push(point);
            }
        }

        return points;
    }

    calculateLinePoint(x, y, hdg, s) {
        const px = x + s * Math.cos(hdg);
        const py = y + s * Math.sin(hdg);
        return new THREE.Vector3(px, 0, py);
    }

    calculateArcPoint(x, y, hdg, s, curvature) {
        if (!curvature || Math.abs(curvature) < 1e-9) {
            return this.calculateLinePoint(x, y, hdg, s);
        }

        const radius = 1 / curvature;
        const angle = s * curvature;
        const px = x + radius * (Math.sin(hdg + angle) - Math.sin(hdg));
        const py = y + radius * (-Math.cos(hdg + angle) + Math.cos(hdg));
        
        return new THREE.Vector3(px, 0, py);
    }

    calculateSpiralPoint(x, y, hdg, s, curvStart, curvEnd, totalLength) {
        if (!totalLength || totalLength <= 0) {
            return this.calculateLinePoint(x, y, hdg, s);
        }

        // 수치 적분으로 클로소이드 근사
        const steps = Math.max(20, Math.ceil(s / 0.5));  // 0.5m 간격
        const ds = s / steps;
        
        let posX = x;
        let posY = y;
        let theta = hdg;

        for (let i = 0; i < steps; i++) {
            const si = i * ds;
            const curvature = curvStart + (curvEnd - curvStart) * (si / totalLength);
            
            posX += ds * Math.cos(theta);
            posY += ds * Math.sin(theta);
            theta += curvature * ds;
        }

        return new THREE.Vector3(posX, 0, posY);
    }

    buildLaneMeshes(road, cameraDistance) {
        try {
            const points = [];
            
            // Reference 라인 포인트 계산
            for (const geometry of road.planView.geometries) {
                const segmentPoints = this.calculateRoadPoints(geometry);
                if (points.length > 0 && segmentPoints.length > 0) {
                    points.push(...segmentPoints.slice(1));
                } else {
                    points.push(...segmentPoints);
                }
            }

            if (points.length === 0) return null;

            // 이전/다음 포인트 정보 추가
            for (let i = 0; i < points.length; i++) {
                points[i].prevPoint = i > 0 ? points[i-1] : null;
                points[i].nextPoint = i < points.length - 1 ? points[i+1] : null;
            }

            const laneSections = road.laneSections || [];
            const group = new THREE.Group();
            group.name = `road_${road.id}_lanes`;

            // 각 레인에 대한 메시 생성
            laneSections.forEach(section => {
                section.lanes.forEach(lane => {
                    if (lane.id === 0) return; // 중앙 레인 제외

                    const lanePoints = [];
                    points.forEach(point => {
                        const offset = this.computeLaneCenterOffset(lane.id, laneSections, point.s, road.laneOffset || []);
                        const lanePoint = this.offsetPoint(point, offset);
                        if (lanePoint && Number.isFinite(lanePoint.x)) {
                            lanePoints.push(lanePoint);
                        }
                    });

                    if (lanePoints.length < 2) return; // 최소 2개의 포인트 필요

                    const geometry = new THREE.BufferGeometry().setFromPoints(lanePoints);
                    const material = new THREE.LineBasicMaterial({ 
                        color: lane.id > 0 ? 0x0000ff : 0x00ff00,  // 양수 ID는 파란색, 음수 ID는 초록색
                        linewidth: 1
                    });
                    const line = new THREE.Line(geometry, material);
                    line.name = `lane_${road.id}_${lane.id}`;
                    line.userData = {
                        type: 'laneLine',
                        roadId: road.id,
                        laneId: lane.id,
                        laneType: lane.type
                    };
                    group.add(line);
                });
            });

            return group;
        } catch (error) {
            this.logger.error(`Error creating lane meshes for road ${road.id}:`, error);
            return null;
        }
    }

    // 단일 포인트 오프셋 계산
    offsetPoint(point, offset) {
        // 이전 포인트와 다음 포인트를 사용하여 접선 방향 계산
        const tangent = new THREE.Vector3(1, 0, 0);  // 기본 접선 방향
        const normal = new THREE.Vector3(0, 0, 1);   // 기본 법선 방향
        
        // 포인트의 접선 방향 계산
        if (point.prevPoint && point.nextPoint) {
            tangent.subVectors(point.nextPoint, point.prevPoint).normalize();
            normal.set(-tangent.z, 0, tangent.x);  // 수정된 법선 계산
        }
        
        // 오프셋 적용
        return new THREE.Vector3(
            point.x + normal.x * offset,
            point.y,
            point.z + normal.z * offset
        );
    }

    // 라인 표시 제어를 위한 메서드들
    setReferenceLinesVisible(visible = true) {
        this.scene.traverse(object => {
            if (object.userData && object.userData.type === 'roadLine') {
                object.visible = visible;
            }
        });
    }

    setLaneLinesVisible(visible = true) {
        this.scene.traverse(object => {
            if (object.userData && object.userData.type === 'laneLine') {
                object.visible = visible;
            }
        });
    }

    setLaneTypeVisible(laneType, visible = true) {
        this.scene.traverse(object => {
            if (object.userData && 
                object.userData.type === 'laneLine' && 
                object.userData.laneType === laneType) {
                object.visible = visible;
            }
        });
    }

    buildRoadSurfaceMesh(road, cameraDistance) {
        try {
            if (!road || !road.referencePoints || road.referencePoints.length < 2) {
                this.logger.warn(`Road ${road.id} has insufficient reference points for surface mesh.`);
                return null;
            }

            const roadWidth = road.lanes ? (road.lanes.left.length + road.lanes.right.length) * 3.5 : 7; // Approximate width
            const leftBoundary = this.offsetPoints(road.referencePoints, roadWidth / 2);
            const rightBoundary = this.offsetPoints(road.referencePoints, -roadWidth / 2);
            
            if (leftBoundary.length < 2 || rightBoundary.length < 2) {
                return null;
            }

            const vertices = [];
            for (let i = 0; i < leftBoundary.length; i++) {
                vertices.push(leftBoundary[i].x, leftBoundary[i].y, leftBoundary[i].z);
                vertices.push(rightBoundary[i].x, rightBoundary[i].y, rightBoundary[i].z);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

            const indices = [];
            for (let i = 0; i < leftBoundary.length - 1; i++) {
                const a = i * 2;
                const b = a + 1;
                const c = a + 2;
                const d = a + 3;
                indices.push(a, b, c);
                indices.push(b, d, c);
            }
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            const material = new THREE.MeshStandardMaterial({
                color: 0x505050,
                side: THREE.DoubleSide,
                wireframe: false
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = `road_surface_${road.id}`;
            return mesh;
        } catch (error) {
            this.logger.error(`buildRoadSurfaceMesh error`, error);
            return null;
        }
    }

    // Evaluate cubic polynomial width
    evaluatePoly(a, b, c, d, ds) {
        return a + b * ds + c * ds * ds + d * ds * ds * ds;
    }

    // Find laneSection for a given s (assumes laneSections sorted by s)
    findLaneSection(laneSections, sGlobal) {
        if (!laneSections || laneSections.length === 0) return null;
        let result = laneSections[0];
        for (let i = 1; i < laneSections.length; i++) {
            if (laneSections[i].s > sGlobal) break;
            result = laneSections[i];
        }
        return result;
    }

    // Get width of a lane at ds (relative to laneSection start)
    getLaneWidthAt(widthSegArr, ds) {
        if (!widthSegArr || widthSegArr.length === 0) return 0;
        let segIndex = 0;
        for (let i = 1; i < widthSegArr.length; i++) {
            if (widthSegArr[i].sOffset > ds) break;
            segIndex = i;
        }
        const seg = widthSegArr[segIndex];
        const { a, b, c, d } = seg;
        // ds relative to segment start, but clamping to next segment boundary to avoid overrun near lane transitions
        let localDs = ds - seg.sOffset;
        if (segIndex < widthSegArr.length - 1) {
            const segLen = widthSegArr[segIndex + 1].sOffset - seg.sOffset;
            if (localDs > segLen) localDs = segLen; // clamp
        }
        let w = this.evaluatePoly(a, b, c, d, localDs);
        if (w < 0.01) w = 0; // clamp tiny values

        // Guard-rail: filter out obviously unrealistic widths that usually stem from malformed data
        // or polynomial evaluation outside its valid range. Anything above ~20 m per lane is abnormal.
        if (w > 20) {
            this.logger.warn(`Excessive lane width (${w.toFixed(2)} m) clamped at 20 m`);
            w = 20;
        }
        return w;
    }

    // after getLaneWidthAt add new function
    getLaneOffsetAt(offsetSegArr, sGlobal) {
        if (!offsetSegArr || offsetSegArr.length === 0) return 0;
        let segIndex = 0;
        for (let i = 1; i < offsetSegArr.length; i++) {
            if (offsetSegArr[i].s > sGlobal) break;
            segIndex = i;
        }
        const seg = offsetSegArr[segIndex];
        const { a, b, c, d, s } = seg;
        const localDs = sGlobal - s;
        return this.evaluatePoly(a,b,c,d,localDs);
    }

    // modify computeLaneCenterOffset signature and implementation
    computeLaneCenterOffset(laneId, laneSections, sGlobal, laneOffsetSegs=[]) {
        const ls = this.findLaneSection(laneSections, sGlobal);
        if (!ls) return 0;
        const left = ls.lanes.filter(l=>l.id>0).sort((a,b)=>a.id-b.id);
        const right = ls.lanes.filter(l=>l.id<0).sort((a,b)=>b.id-a.id);

        let acc=0;
        if (laneId>0) {
            for (const l of left) {
                if(l.type==='none') { if(l.id===laneId) break; else continue; }
                let w = this.getLaneWidthAt(l.widthSeg, sGlobal - ls.s);
                if (SKIP_ZERO_WIDTH && w===0) { if(l.id===laneId) break; else continue; }
                if (l.id === laneId) { acc += w/2; break;} else acc += w;
            }
        } else if (laneId<0){
            for (const l of right) {
                if(l.type==='none') { if(l.id===laneId) break; else continue; }
                let w = this.getLaneWidthAt(l.widthSeg, sGlobal - ls.s);
                if (SKIP_ZERO_WIDTH && w===0) { if(l.id===laneId) break; else continue; }
                if (l.id === laneId) { acc += w/2; break;} else acc += w;
            }
            acc = -acc;
        }
        // LaneOffset 적용 (positive values shift entire cross-section to the left)
        const laneOffsetVal = this.getLaneOffsetAt(laneOffsetSegs, sGlobal);
        return acc + laneOffsetVal;
    }

    buildRoadMarkMeshes(road, cameraDistance) {
        try {
            const markGroup = new THREE.Group();
            markGroup.name = `road_marks_${road.id}`;

            if (!road.roadMarks || !Array.isArray(road.roadMarks)) {
                return null;
            }

            for (const mark of road.roadMarks) {
                if (!mark.points || mark.points.length < 2) continue;

                // Ensure points are THREE.Vector3 objects
                const points = mark.points.map(p => new THREE.Vector3(p.x, p.y, p.z || 0));

                const markMaterial = new THREE.LineBasicMaterial({
                    color: 0xffffff,
                    linewidth: 1,
                    transparent: true,
                    opacity: 0.8
                });

                for (let i = 0; i < points.length - 1; i++) {
                    const p1 = points[i];
                    const p2 = points[i+1];
                    if (!p1 || !p2) continue; // Safety check

                    const dir = new THREE.Vector3().subVectors(p2, p1);
                    const len = dir.length();
                    dir.normalize();

                    const dashSize = 0.5;
                    const gapSize = 0.5;
                    const lineLength = dashSize + gapSize;
                    
                    for (let j = 0; j < len; j += lineLength) {
                        const start = new THREE.Vector3().addVectors(p1, dir.clone().multiplyScalar(j));
                        const end = new THREE.Vector3().addVectors(start, dir.clone().multiplyScalar(Math.min(dashSize, len - j)));
                        
                        const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
                        const line = new THREE.Line(geom, markMaterial);
                        markGroup.add(line);
                    }
                }
            }
            return markGroup;
        } catch (error) {
            this.logger.error(`buildRoadMarkMeshes error`, error);
            return null;
        }
    }

    setOnlyReferenceLinesVisible(visible=true){
        this.roadContainer.traverse(o=>{
            o.visible = o.userData?.type === 'referenceLine' ? true : !visible;
        });
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.renderer.render(this.scene, this.camera);
    }

    buildRoadReferenceLines(road, roadId) {
        try {
            const points = [];
            const referencePoints = [];
            
            // 각 지오메트리 세그먼트 처리
            for (const geometry of road.planView.geometries) {
                const segmentPoints = this.calculateRoadPoints(geometry);
                if (points.length > 0 && segmentPoints.length > 0) {
                    points.push(...segmentPoints.slice(1));
                } else {
                    points.push(...segmentPoints);
                }
            }

            if (points.length < 2) {
                this.logger.warn(`Road ${roadId} has insufficient points for reference line`);
                return null;
            }

            // 버퍼 지오메트리 생성
            const roadGeometry = new THREE.BufferGeometry();
            roadGeometry.setFromPoints(points);

            // 도로 메시 생성
            const roadMaterial = new THREE.LineBasicMaterial({ 
                color: 0xff0000,  // 빨간색
                linewidth: 2
            });
            const roadMesh = new THREE.Line(roadGeometry, roadMaterial);
            roadMesh.name = `road_ref_group_${roadId}`;
            roadMesh.userData = { 
                type: 'referenceLine', 
                roadId: roadId, 
                length: road.length 
            };

            return {
                roadLineGroup: roadMesh,
                referencePoints: points
            };
        } catch (error) {
            this.logger.error(`Error creating reference line for road ${roadId}:`, error);
            return null;
        }
    }

    /**
     * Offsets a line of points by a specified distance perpendicular to the direction of the line segments.
     * @param {THREE.Vector3[]} points - The original points of the line.
     * @param {number} offset - The distance to offset the points. Positive values offset to the left, negative to the right.
     * @returns {THREE.Vector3[]} The new array of offset points.
     */
    offsetPoints(points, offset) {
        if (!points || points.length < 2) {
            return [];
        }

        const offsetPoints = [];

        for (let i = 0; i < points.length; i++) {
            let dir;
            if (i === 0) {
                // First point
                dir = new THREE.Vector3().subVectors(points[i + 1], points[i]);
            } else if (i === points.length - 1) {
                // Last point
                dir = new THREE.Vector3().subVectors(points[i], points[i - 1]);
            } else {
                // Middle points: average the direction of the two segments
                const dir1 = new THREE.Vector3().subVectors(points[i], points[i - 1]);
                const dir2 = new THREE.Vector3().subVectors(points[i + 1], points[i]);
                dir = new THREE.Vector3().addVectors(dir1, dir2).multiplyScalar(0.5);
            }

            dir.normalize();
            const normal = new THREE.Vector3(-dir.y, dir.x, 0); // Perpendicular vector in 2D
            normal.multiplyScalar(offset);

            const newPoint = new THREE.Vector3().addVectors(points[i], normal);
            offsetPoints.push(newPoint);
        }

        return offsetPoints;
    }
} 