import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js';
import { DebugLogger } from './DebugLogger.js';

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
            for (const geometry of road.planView.geometries) {
                const segmentPoints = this.calculateRoadPoints(geometry, interval);
                points.push(...segmentPoints);
            }

            // 버퍼 지오메트리 생성
            roadGeometry.setFromPoints(points);

            // 도로 메시 생성
            const roadMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
            const roadMesh = new THREE.Line(roadGeometry, roadMaterial);
            roadMesh.name = `road_${road.id}`;

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
        const points = [];
        const { x, y, hdg, length, type, params } = geometry;

        // 포인트 수 계산 (간격에 따라)
        const numPoints = Math.max(2, Math.ceil(length / interval));

        for (let i = 0; i <= numPoints; i++) {
            const s = (i / numPoints) * length;
            let point;

            switch (type) {
                case 'line':
                    point = this.calculateLinePoint(x, y, hdg, s);
                    break;
                case 'arc':
                    point = this.calculateArcPoint(x, y, hdg, s, params.curvature);
                    break;
                case 'spiral':
                    point = this.calculateSpiralPoint(x, y, hdg, s, params.curvStart, params.curvEnd);
                    break;
                default:
                    this.logger.warn(`Unsupported geometry type: ${type}`);
                continue;
            }

            points.push(point);
        }

        return points;
    }

    calculateLinePoint(x, y, hdg, s) {
        return new THREE.Vector3(
            x + s * Math.cos(hdg),
            y + s * Math.sin(hdg),
            0
        );
    }

    calculateArcPoint(x, y, hdg, s, curvature) {
        const radius = 1 / curvature;
        const angle = s * curvature;
        const dx = radius * Math.sin(angle);
        const dy = radius * (1 - Math.cos(angle));
        
        return new THREE.Vector3(
            x + dx * Math.cos(hdg) - dy * Math.sin(hdg),
            y + dx * Math.sin(hdg) + dy * Math.cos(hdg),
            0
        );
    }

    calculateSpiralPoint(x, y, hdg, s, curvStart, curvEnd) {
        // 간단한 선형 보간으로 구현
        const curvature = curvStart + (curvEnd - curvStart) * (s / length);
        return this.calculateArcPoint(x, y, hdg, s, curvature);
    }
} 