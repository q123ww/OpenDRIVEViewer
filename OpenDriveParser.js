class OpenDriveParser {
    constructor() {
        this.logger = {
            log: (...args) => console.log('[Parser]', ...args),
            error: (...args) => console.error('[Parser]', ...args),
            warn: (...args) => console.warn('[Parser]', ...args)
        };
        }

    parse(xmlText) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            
            // OpenDRIVE 루트 요소 확인
            const openDriveElement = xmlDoc.querySelector('OpenDRIVE');
            if (!openDriveElement) {
                throw new Error('Invalid OpenDRIVE file: Missing root element');
            }

            // 기본 정보 추출
            const roads = Array.from(xmlDoc.querySelectorAll('road')).map(road => {
                const id = road.getAttribute('id');
                const name = road.getAttribute('name') || `Road ${id}`;
                const length = parseFloat(road.getAttribute('length'));
                
                // 기본 도로 정보
                const roadInfo = {
                    id,
                    name,
                    length,
                    planView: this.parsePlanView(road),
                    lanes: this.parseLanes(road),
                    needsDetails: true,
                    rawRoadElementContent: road.outerHTML
                };

                return roadInfo;
            });

            return {
                roads,
                version: openDriveElement.getAttribute('version'),
                date: openDriveElement.getAttribute('date'),
                vendor: openDriveElement.getAttribute('vendor')
            };
        } catch (error) {
            this.logger.error('Error parsing OpenDRIVE file:', error);
            throw error;
        }
    }

    parsePlanView(roadElement) {
        const planView = roadElement.querySelector('planView');
        if (!planView) return null;

        const geometries = Array.from(planView.querySelectorAll('geometry')).map(geom => {
            const x = parseFloat(geom.getAttribute('x'));
            const y = parseFloat(geom.getAttribute('y'));
            const s = parseFloat(geom.getAttribute('s'));
            const hdg = parseFloat(geom.getAttribute('hdg'));
            const length = parseFloat(geom.getAttribute('length'));

            const line = geom.querySelector('line');
            const arc = geom.querySelector('arc');
            const spiral = geom.querySelector('spiral');
            const poly3 = geom.querySelector('poly3');
            const paramPoly3 = geom.querySelector('paramPoly3');

            let type = 'line';
            let params = {};

            if (line) {
                type = 'line';
            } else if (arc) {
                type = 'arc';
                params.curvature = parseFloat(arc.getAttribute('curvature'));
            } else if (spiral) {
                type = 'spiral';
                params.curvStart = parseFloat(spiral.getAttribute('curvStart'));
                params.curvEnd = parseFloat(spiral.getAttribute('curvEnd'));
            } else if (poly3) {
                type = 'poly3';
                params.a = parseFloat(poly3.getAttribute('a'));
                params.b = parseFloat(poly3.getAttribute('b'));
                params.c = parseFloat(poly3.getAttribute('c'));
                params.d = parseFloat(poly3.getAttribute('d'));
            } else if (paramPoly3) {
                type = 'paramPoly3';
                params.aU = parseFloat(paramPoly3.getAttribute('aU'));
                params.bU = parseFloat(paramPoly3.getAttribute('bU'));
                params.cU = parseFloat(paramPoly3.getAttribute('cU'));
                params.dU = parseFloat(paramPoly3.getAttribute('dU'));
                params.aV = parseFloat(paramPoly3.getAttribute('aV'));
                params.bV = parseFloat(paramPoly3.getAttribute('bV'));
                params.cV = parseFloat(paramPoly3.getAttribute('cV'));
                params.dV = parseFloat(paramPoly3.getAttribute('dV'));
            }

            return {
                x, y, s, hdg, length, type, params
            };
        });

        return { geometries };
    }

    parseLanes(roadElement) {
        const lanes = roadElement.querySelector('lanes');
        if (!lanes) return null;

        const laneSections = Array.from(lanes.querySelectorAll('laneSection')).map(section => {
            const s = parseFloat(section.getAttribute('s'));
            const left = section.querySelector('left');
            const center = section.querySelector('center');
            const right = section.querySelector('right');

            const parseLaneGroup = (group) => {
                if (!group) return [];
                return Array.from(group.querySelectorAll('lane')).map(lane => {
                    const id = parseInt(lane.getAttribute('id'));
                    const type = lane.getAttribute('type');
                    const level = lane.getAttribute('level') === 'true';
                    const width = this.parseLaneWidth(lane);

                    return {
                        id,
                        type,
                        level,
                        width
                    };
                });
            };

        return {
                s,
                left: parseLaneGroup(left),
                center: parseLaneGroup(center),
                right: parseLaneGroup(right)
        };
        });

        return { laneSections };
    }

    parseLaneWidth(laneElement) {
        const width = laneElement.querySelector('width');
        if (!width) return null;

        return {
            sOffset: parseFloat(width.getAttribute('sOffset')),
            a: parseFloat(width.getAttribute('a')),
            b: parseFloat(width.getAttribute('b')),
            c: parseFloat(width.getAttribute('c')),
            d: parseFloat(width.getAttribute('d'))
        };
    }

    parseRoadDetails(roadInfo) {
        try {
            if (!roadInfo.rawRoadElementContent) {
                throw new Error('No raw content available for parsing');
            }

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(roadInfo.rawRoadElementContent, 'text/xml');
            const road = xmlDoc.querySelector('road');

            // 상세 정보 파싱
            const detailedInfo = {
                ...roadInfo,
                needsDetails: false
            };

            // 연결 정보 파싱
            const link = road.querySelector('link');
            if (link) {
                const predecessor = link.querySelector('predecessor');
                const successor = link.querySelector('successor');

                if (predecessor) {
                    detailedInfo.predecessor = {
                        elementType: predecessor.getAttribute('elementType'),
                        elementId: predecessor.getAttribute('elementId'),
                        contactPoint: predecessor.getAttribute('contactPoint')
                    };
                }

                if (successor) {
                    detailedInfo.successor = {
                        elementType: successor.getAttribute('elementType'),
                        elementId: successor.getAttribute('elementId'),
                        contactPoint: successor.getAttribute('contactPoint')
                    };
                }
            }

            return detailedInfo;
        } catch (error) {
            this.logger.error('Error parsing road details:', error);
            throw error;
        }
    }
}

// Worker에서 사용할 수 있도록 전역 스코프에 노출
if (typeof self !== 'undefined') {
    self.OpenDriveParser = OpenDriveParser;
} 