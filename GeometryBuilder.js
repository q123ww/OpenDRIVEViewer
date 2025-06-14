import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js';
import { DebugLogger } from './DebugLogger.js';

// Toggle: if true, zero-width lanes (after clamping) are ignored in cumulative width.
const SKIP_ZERO_WIDTH = true;

export class GeometryBuilder {
    constructor(logger) {
        this.logger = logger;
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
            // 카메라 거리에 따른 LOD 레벨 업데이트
            this.updateLodLevel(cameraDistance);

            // 현재 LOD 레벨의 간격 가져오기
            const interval = this.lodLevels[this.currentLodLevel].interval;

            // 도로 지오메트리 생성
            const roadGeometry = new THREE.BufferGeometry();
            const points = [];

            // 도로의 각 지오메트리 세그먼트 처리
            for (let gi = 0; gi < road.planView.geometries.length; gi++) {
                const geometry = road.planView.geometries[gi];
                let seg = this.calculateRoadPoints(geometry, interval).map(o=>o.point);
                if (gi > 0 && seg.length > 0) {
                    // 중복 첫 포인트 제거
                    seg = seg.slice(1);
                }
                points.push(...seg);
            }

            // 버퍼 지오메트리 생성
            roadGeometry.setFromPoints(points);

            // 도로 메시 생성
            const roadMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
            const roadMesh = new THREE.Line(roadGeometry, roadMaterial);
            roadMesh.name = `road_${road.id}`;
            roadMesh.userData = { type:'roadLine', roadId: road.id, length: road.length };

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

    calculateRoadPoints(geometry, interval) {
        const arr = [];
        const { x, y, hdg, length, type, params = {}, s: geomStartS = 0 } = geometry;

        const numPoints = Math.max(2, Math.ceil(length / interval));

        for (let i = 0; i <= numPoints; i++) {
            const sLocal = (i / numPoints) * length;
            let point;

            switch (type) {
                case 'line':
                    point = this.calculateLinePoint(x, y, hdg, sLocal);
                    break;
                case 'arc': {
                    const curvature = typeof params.curvature === 'number' ? params.curvature : 0;
                    point = this.calculateArcPoint(x, y, hdg, sLocal, curvature);
                    break;
                }
                case 'spiral': {
                    const cs = typeof params.curvStart === 'number' ? params.curvStart : 0;
                    const ce = typeof params.curvEnd === 'number' ? params.curvEnd : 0;
                    point = this.calculateSpiralPoint(x, y, hdg, sLocal, cs, ce, length);
                    break;
                }
                case 'poly3': {
                    const a = typeof params.a === 'number' ? params.a : 0;
                    const b = typeof params.b === 'number' ? params.b : 0;
                    const c = typeof params.c === 'number' ? params.c : 0;
                    const d = typeof params.d === 'number' ? params.d : 0;
                    point = this.calculatePoly3Point(x, y, hdg, sLocal, a, b, c, d);
                    break;
                }
                default:
                    this.logger.warn(`Unsupported geometry type: ${type}`);
                    continue;
            }

            if (point && Number.isFinite(point.x)) {
                arr.push({ point, s: geomStartS + sLocal });
            }
        }

        return arr;
    }

    calculateLinePoint(x, y, hdg, s) {
        const px = x + s * Math.cos(hdg);
        const py = y + s * Math.sin(hdg);
        return new THREE.Vector3(px, 0, -py);
    }

    calculateArcPoint(x, y, hdg, s, curvature) {
        const EPS = 1e-9;
        if (!curvature || Math.abs(curvature) < EPS) {
            return this.calculateLinePoint(x, y, hdg, s);
        }

        // 적분 간격 설정: 0.5 m 이하, 최소 20 스텝
        const targetStep = 0.5;
        let steps = Math.ceil(s / targetStep);
        steps = Math.max(steps, 20);
        const ds = s / steps;

        let posX = x;
        let posY = y;
        let theta = hdg; // 현재 전역 헤딩

        for (let i = 0; i < steps; i++) {
            posX += ds * Math.cos(theta);
            posY += ds * Math.sin(theta);
            theta += curvature * ds; // 일정 곡률
        }

        return new THREE.Vector3(posX, 0, -posY);
    }

    calculateSpiralPoint(x, y, hdg, s, curvStart, curvEnd, totalLength) {
        if (!totalLength || totalLength <= 0) {
            return this.calculateLinePoint(x, y, hdg, s);
        }

        // 간단한 수치 적분으로 클로소이드 근사 (Euler integration)
        // 정확도 향상을 위해 0.5 m 이하 간격으로 적분 (최소 40 스텝, 최대 2000 스텝)
        const targetStep = 0.5;                    // 적분 간격 [m]
        let steps = Math.ceil(s / targetStep);
        steps = Math.min(Math.max(steps, 40), 2000); // 40 ≤ steps ≤ 2000
        const ds = s / steps;
        let posX = x;
        let posY = y;
        let theta = hdg; // 현재 헤딩 (전역)

        for (let i = 0; i < steps; i++) {
            const si = i * ds;
            const curvature = curvStart + (curvEnd - curvStart) * (si / totalLength);
            // advance position
            posX += ds * Math.cos(theta);
            posY += ds * Math.sin(theta);
            // update heading for next step (kappa * ds)
            theta += curvature * ds;
        }

        return new THREE.Vector3(posX, 0, -posY);
    }

    // poly3: y(s) = a + b*s + c*s^2 + d*s^3 (OpenDRIVE 정의)
    // 로컬 좌표계를 전역으로 변환
    calculatePoly3Point(x, y, hdg, s, a, b, c, d) {
        const u = s; // 로컬 s 축 (전진 방향)
        const v = a + b * u + c * u * u + d * u * u * u; // 횡방향 offset

        // 로컬 (u,v) → 전역 (px, py)
        const px = x + u * Math.cos(hdg) - v * Math.sin(hdg);
        const py = y + u * Math.sin(hdg) + v * Math.cos(hdg);

        return new THREE.Vector3(px, 0, -py);
    }

    buildLaneMeshes(road, cameraDistance) {
        try {
            this.updateLodLevel(cameraDistance);
            const interval = this.lodLevels[this.currentLodLevel].interval;

            // reference samples with s values
            const refArr=[];
            for (const geometry of road.planView.geometries) {
                const arr = this.calculateRoadPoints(geometry, interval);
                if (refArr.length && arr.length) {
                    refArr.push(...arr.slice(1));
                } else {
                    refArr.push(...arr);
                }
            }
            if (refArr.length===0) return null;

            const laneSections = road.laneSections || [];

            // Collect unique lane IDs across all laneSections (excluding center lane 0)
            const laneIdSet = new Set();
            laneSections.forEach(ls=>{
                ls.lanes.forEach(l=>{ if(l.id!==0) laneIdSet.add(l.id); });
            });
            if (laneIdSet.size===0) return null;

            const group = new THREE.Group();
            group.name = `road_${road.id}_lanes`;

            laneIdSet.forEach(laneId=>{
                // Determine representative laneType from first occurrence
                let laneType='unknown';
                for(const ls of laneSections){
                    const match = ls.lanes.find(l=>l.id===laneId);
                    if(match){ laneType=match.type; break; }
                }

                const lanePts=[];
                for (const sample of refArr) {
                    const offset = this.computeLaneCenterOffset(laneId, laneSections, sample.s, road.laneOffset || []);
                    const pt = this.offsetPoints([sample.point], offset)[0];
                    lanePts.push(pt);
                }
                const geom = new THREE.BufferGeometry().setFromPoints(lanePts);
                const mat = new THREE.LineBasicMaterial({ color: laneId>0?0x00ff00:0x0000ff });
                const line = new THREE.Line(geom, mat);
                line.userData = {type:'laneCenter', laneId: laneId, roadId: road.id, laneType: laneType};
                group.add(line);
            });

            // Fast path: if lane objects already contain precomputed centerline arrays (from WASM),
            // build simple Line meshes directly and skip offset/width math.
            if (laneSections[0].lanes && laneSections[0].lanes[0] && laneSections[0].lanes[0].centerline) {
                const groupCenter = new THREE.Group();
                groupCenter.name = `road_${road.id}_lanes_centerline`;
                for (const ls of laneSections) {
                    for (const lane of ls.lanes) {
                        if(lane.id===0) continue;
                        if(!lane.centerline || lane.centerline.length<2) continue;
                        const pts = lane.centerline.map(p=>new THREE.Vector3(p.x, p.y, -p.z));
                        const geom = new THREE.BufferGeometry().setFromPoints(pts);
                        const mat  = new THREE.LineBasicMaterial({color:0x00ffff});
                        const line = new THREE.Line(geom, mat);
                        line.name = `lane_center_${road.id}_${lane.id}`;
                        line.userData={type:'laneCenter', roadId:road.id, laneId:lane.id};
                        groupCenter.add(line);
                    }
                }
                return groupCenter;
            }

            return group;
        } catch (err) {
            this.logger.error('buildLaneMeshes error', err);
            return null;
        }
    }

    // helper to offset polyline in XY plane by distance (positive left side)
    offsetPoints(points, offset) {
        const offsetPts = [];
        for (let i=0;i<points.length;i++){
            const p = points[i];
            // compute tangent
            let dir;
            if (points.length===1){
                dir = new THREE.Vector3(1,0,0); // arbitrary X direction
            } else if (i===0) {
                dir = new THREE.Vector3().subVectors(points[i+1], p);
            } else if (i===points.length-1){
                dir = new THREE.Vector3().subVectors(p, points[i-1]);
            } else {
                dir = new THREE.Vector3().subVectors(points[i+1], points[i-1]);
            }
            dir.y=0; // ensure horizontal
            dir.normalize();
            // normal vector in XZ plane rotated 90deg (left is +Z?). For XY to XZ mapping, with Z=-y.
            const normal = new THREE.Vector3(-dir.z, 0, dir.x); // left-hand normal
            const newPt = new THREE.Vector3().copy(p).addScaledVector(normal, offset);
            offsetPts.push(newPt);
        }
        return offsetPts;
    }

    buildRoadSurfaceMesh(road, cameraDistance) {
        try {
            this.updateLodLevel(cameraDistance);
            const interval = this.lodLevels[this.currentLodLevel].interval;

            // reference line sample points
            const refArr = [];
            for (const geom of road.planView.geometries) {
                const pts = this.calculateRoadPoints(geom, interval);
                if (refArr.length && pts.length) {
                    refArr.push(...pts.slice(1));
                    } else { 
                    refArr.push(...pts);
                }
            }
            if (refArr.length < 2) return null;

            // build arrays of Vector3 and global s
            const refPts = refArr.map(o=>o.point);
            const sVals = refArr.map(o=>o.s);

            const laneSections = road.laneSections || [];

            // helper to compute cumulative widths at global s
            const getWidths = (sGlobal) => {
                const ls = this.findLaneSection(laneSections, sGlobal);
                if (!ls) return {left:3.5, right:3.5};
                const leftLanes = ls.lanes.filter(l=>l.id>0).sort((a,b)=>a.id-b.id);
                const rightLanes = ls.lanes.filter(l=>l.id<0).sort((a,b)=>b.id-a.id);
                let left=0,right=0;
                leftLanes.forEach(l=>{
                    if(l.type==='none') return;
                    let w = this.getLaneWidthAt(l.widthSeg, sGlobal - ls.s);
                    if (SKIP_ZERO_WIDTH && w === 0) return;
                    left += w;
                });
                rightLanes.forEach(l=>{
                    if(l.type==='none') return;
                    let w = this.getLaneWidthAt(l.widthSeg, sGlobal - ls.s);
                    if (SKIP_ZERO_WIDTH && w === 0) return;
                    right += w;
                });
                const widthProblem = !Number.isFinite(left) || !Number.isFinite(right) || left < 0 || right < 0;
                if (widthProblem || left > 60 || right > 60) {
                    // 심각한 오류 – 데이터 손상 가능성
                    this.logger.error(`Abnormal width on road ${road.id} at s=${sGlobal.toFixed(1)} left=${left} right=${right}`);
                } else if (left > 30 || right > 30) {
                    // 차로 수가 매우 많은 구간 – 정보성 경고로 처리
                    this.logger.warn(`Very wide carriageway on road ${road.id} at s=${sGlobal.toFixed(1)} left=${left} right=${right}`);
                }
                return {left, right};
            };

            const leftPts = [];
            const rightPts = [];
            for (let i=0;i<refPts.length;i++){
                const widths = getWidths(sVals[i]);
                const laneOff = this.getLaneOffsetAt(road.laneOffset || [], sVals[i]);
                leftPts.push(this.offsetPoints([refPts[i]], laneOff + widths.left)[0]);
                rightPts.push(this.offsetPoints([refPts[i]], laneOff - widths.right)[0]);
            }

            const vertexCount = refPts.length * 2;
            const positions = new Float32Array(vertexCount * 3);

            for (let i = 0; i < refPts.length; i++) {
                const lp = leftPts[i];
                const rp = rightPts[i];
                positions.set([lp.x, lp.y, lp.z], i * 6);
                positions.set([rp.x, rp.y, rp.z], i * 6 + 3);
            }

            const indices = [];
            for (let i = 0; i < refPts.length - 1; i++) {
                const a = i * 2;
                const b = a + 1;
                const c = a + 2;
                const d = a + 3;
                // first triangle a,c,b ; second c,d,b
                indices.push(a, c, b, c, d, b);
            }

            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geom.setIndex(indices);
            geom.computeVertexNormals();

            const mat = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.name = `roadSurface_${road.id}`;
            mesh.userData = { type: 'roadSurface', roadId: road.id };
            return mesh;
        } catch (err) {
            this.logger.error('buildRoadSurfaceMesh error', err);
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

    buildRoadMarkMeshes(road, cameraDistance){
        try{
            this.updateLodLevel(cameraDistance);
            const interval=this.lodLevels[this.currentLodLevel].interval;

            // sample reference
            const refArr=[];
            for(const geom of road.planView.geometries){
                const arr=this.calculateRoadPoints(geom,interval);
                if(refArr.length&&arr.length) refArr.push(...arr.slice(1));
                else refArr.push(...arr);
            }
            if(refArr.length===0) return null;

            const laneSections=road.laneSections||[];
            if(!laneSections.length) return null;

            const group=new THREE.Group();
            group.name=`road_${road.id}_marks`;

            const addBoundary=(boundaryOffsetArr, markInfo)=>{
                const geom=new THREE.BufferGeometry().setFromPoints(boundaryOffsetArr);
                let material;
                if(markInfo&&markInfo.type&&markInfo.type.includes('broken')){
                    material=new THREE.LineDashedMaterial({color:0xffffff,dashSize:3,gapSize:3});
                }else{
                    material=new THREE.LineBasicMaterial({color:0xffffff});
                }
                const line=new THREE.Line(geom,material);
                if(material instanceof THREE.LineDashedMaterial){
                    line.computeLineDistances();
                }
                line.userData={type:'laneMark',roadId:road.id};
                group.add(line);
            };

            // iterate through sample points to build offsets arrays for left/right boundaries of each lane
            const firstLsLanes=laneSections[0].lanes;
            for(const lane of firstLsLanes){
                if(lane.id===0) continue; // center lane no boundary
                const boundaryPts=[];
                for(let idx=0; idx<refArr.length; idx++){
                    const sample=refArr[idx];
                    const centerOffset=this.computeLaneCenterOffset(lane.id,laneSections,sample.s, road.laneOffset || []);
                    const halfWidth=this.getLaneWidthAt(lane.widthSeg, sample.s - this.findLaneSection(laneSections,sample.s).s)/2;
                    const bOffset = lane.id>0 ? centerOffset-halfWidth : centerOffset+halfWidth;

                    // tangent dir
                    let dir;
                    if (idx===0) {
                        dir = new THREE.Vector3().subVectors(refArr[idx+1].point, sample.point);
                    } else if (idx===refArr.length-1){
                        dir = new THREE.Vector3().subVectors(sample.point, refArr[idx-1].point);
                    } else {
                        dir = new THREE.Vector3().subVectors(refArr[idx+1].point, refArr[idx-1].point);
                    }
                    dir.y=0; dir.normalize();
                    const normal=new THREE.Vector3(-dir.z,0,dir.x);
                    const pt=new THREE.Vector3().copy(sample.point).addScaledVector(normal,bOffset);
                    boundaryPts.push(pt);
                }
                addBoundary(boundaryPts, lane.roadMark);
            }

            return group;
        }catch(err){
            this.logger.error('buildRoadMarkMeshes error',err);
            return null;
        }
    }

    setOnlyReferenceLinesVisible(visible=true){
        this.roadContainer.traverse(o=>{
            o.visible = o.userData?.type === 'referenceLine' ? true : !visible;
        });
    }
} 