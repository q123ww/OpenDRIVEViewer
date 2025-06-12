// Hexagon/OpenDRIVEViewer/parser.worker.js

// 이 로그는 워커 파일이 브라우저에 의해 처음 파싱될 때 콘솔에 찍힐 수 있습니다.
// (메인 스레드 콘솔이 아닌, 워커 컨텍스트의 콘솔일 수 있으나, Sources 탭에서 중단점 등으로 확인 가능)
console.log('[WorkerLOG] ParserWorker: Script top-level. File is being parsed.');

// 메인 스레드로 워커가 살아있음을 알리는 메시지를 즉시 보냅니다.
try {
    self.postMessage({
        type: 'log',
        level: 'info',
        // timestamp: new Date().toISOString(), // DebugLogger가 타임스탬프를 찍으므로 여기선 제외해도 됨
        message: "ParserWorker: ALIVE and script successfully loaded/parsed."
    });
} catch (e) {
    // postMessage 자체가 실패하는 극단적인 경우 (매우 드묾)
    console.error('[WorkerLOG] ParserWorker: Failed to post initial ALIVE message:', e);
}

// --- OpenDriveParser 클래스 코드 시작 (OpenDriveParser.js에서 복사 후 수정) ---
class OpenDriveParser {
    constructor(loggerReplacer) { // Worker에서는 console 대신 postMessage 사용
        const getTimestamp = () => new Date().toISOString(); // ISOString 표준 시간 사용
        this.logger = loggerReplacer || {
            log: (...args) => self.postMessage({ type: 'log', level: 'info', timestamp: getTimestamp(), message: args.join(' ') }),
            warn: (...args) => self.postMessage({ type: 'log', level: 'warn', timestamp: getTimestamp(), message: args.join(' ') }),
            error: (...args) => self.postMessage({ type: 'log', level: 'error', timestamp: getTimestamp(), message: args.join(' ') })
        };
    }

    parseInitialFromRoadStrings(roadXmlStrings, headerData) {
        this.logger.log(`ParserWorker: Starting INITIAL parsing from ${roadXmlStrings?.length || 0} road strings.`);
        const parsedData = {
            header: headerData || {},
            roads: [],
        };

        if (!roadXmlStrings || roadXmlStrings.length === 0) {
            this.logger.warn("ParserWorker: No road XML strings provided for parsing.");
            return parsedData;
        }

        for (const roadXmlString of roadXmlStrings) {
            const roadObject = this._parseRoadFromString(roadXmlString);
            if (roadObject) {
                parsedData.roads.push(roadObject);
            } else {
                // _parseRoadFromString이 null을 반환하는 경우 (예: ID 파싱 실패) 로깅 추가
                this.logger.warn(`ParserWorker: Failed to parse a road object from string (first 100 chars): ${roadXmlString.substring(0, 100)}`);
            }
        }
        this.logger.log(`ParserWorker: Finished INITIAL parsing. Parsed basic info for ${parsedData.roads.length} of ${roadXmlStrings.length} road strings provided.`);
        if (parsedData.roads.length === 0 && roadXmlStrings.length > 0) {
            this.logger.error(`ParserWorker: CRITICAL - No roads were successfully parsed from ${roadXmlStrings.length} input strings. Resulting roads array is EMPTY.`);
        }
        return parsedData;
    }

    _parseRoadFromString(roadXmlString) {
        const getAttribute = (xml, attr) => {
            const match = xml.match(new RegExp(`${attr}\\s*=\\s*\"([^\"]*)\"`));
            return match ? match[1] : null;
        };

        const roadTagMatch = roadXmlString.match(/^<road([^>]*)>/);
        if (!roadTagMatch) {
            this.logger.warn("ParserWorker: Could not find <road> tag start from XML string (first 100 chars):", roadXmlString.substring(0,100));
            return null;
        }
        const roadAttributesString = roadTagMatch[1];

        const id = getAttribute(roadAttributesString, 'id');
        if (id === null) {
            this.logger.warn("ParserWorker: Could not parse road ID from attributes string (first 100 chars of road str):", roadXmlString.substring(0, 100));
            return null;
        }

        const name = getAttribute(roadAttributesString, 'name');
        const length = getAttribute(roadAttributesString, 'length');
        const junction = getAttribute(roadAttributesString, 'junction');

        const debugIDs = ['516', '502', '505']; // 특정 도로 디버깅용
        if (debugIDs.includes(id)) {
            this.logger.log(`ParserWorker: DEBUG road ${id} XML String (first 200 chars): ${roadXmlString.substring(0,200)}`);
        }

        let planView = { geometries: [] };
        // 정규식 패턴을 문자열 변수로 분리하고 RegExp 생성자 사용
        const geometryPatternString = '<geometry([^>]*)>([^<]*(?:<(?!\\/geometry>)[^<]*)*)<\\/geometry>';
        const geometryRegExp = new RegExp(geometryPatternString);
        const geometryMatch = roadXmlString.match(geometryRegExp);
        
        if (debugIDs.includes(id)) {
            // this.logger.log(`ParserWorker: DEBUG road ${id} geometryMatch result: ${JSON.stringify(geometryMatch)}`);
            if (geometryMatch) {
                this.logger.log(`ParserWorker: DEBUG road ${id} geometryMatch SUCCEEDED. Match length: ${geometryMatch.length}. Attributes part: ${geometryMatch[1]?.substring(0,100)}, Content part (first 50): ${geometryMatch[2]?.substring(0,50)}`);
            } else {
                this.logger.warn(`ParserWorker: DEBUG road ${id} geometryMatch FAILED (is null). This road's geometry block could not be matched by the regex. roadXmlString (first 500 chars): ${roadXmlString.substring(0,500)}`);
            }
        }

        if (geometryMatch) {
            const geomAttributesString = geometryMatch[1];
            const geomContent = geometryMatch[2]; // This is the content between <geometry> tags
            const s = getAttribute(geomAttributesString, 's');
            const x = getAttribute(geomAttributesString, 'x');
            const y = getAttribute(geomAttributesString, 'y');
            const hdg = getAttribute(geomAttributesString, 'hdg');
            const geomLength = getAttribute(geomAttributesString, 'length');
            
            let type = 'unknown';
            // geomContent에서 실제 지오메트리 태그 (line, arc 등)를 찾아야 합니다.
            if (geomContent.includes('<line')) type = 'line';
            else if (geomContent.includes('<arc')) type = 'arc';
            else if (geomContent.includes('<spiral')) type = 'spiral';
            else if (geomContent.includes('<poly3')) type = 'poly3';
            else if (geomContent.includes('<paramPoly3')) type = 'paramPoly3';

            if (debugIDs.includes(id)) {
                this.logger.log(`ParserWorker: DEBUG road ${id} Extracted geom attrs: s=${s}, x=${x}, y=${y}, hdg=${hdg}, length=${geomLength}, type=${type}`);
                this.logger.log(`ParserWorker: DEBUG road ${id} geomContent (first 50 chars): ${geomContent.substring(0,50)}`);
            }
            
            if (s !== null && x !== null && y !== null && hdg !== null && geomLength !== null) {
                const geometryObject = {
                    s: parseFloat(s),
                    x: parseFloat(x),
                    y: parseFloat(y),
                    hdg: parseFloat(hdg),
                    length: parseFloat(geomLength),
                    type: type,
                    // 여기에 각 geometry 타입에 따른 추가 속성 (a,b,c,d 또는 u,v 등) 파싱 로직이 추가되어야 합니다.
                    // 예를 들어, type이 'arc'이면 curvature를 파싱해야 합니다.
                    // 현재는 type만 기록합니다.
                };
                planView.geometries.push(geometryObject);
                if (debugIDs.includes(id)) {
                    this.logger.log(`ParserWorker: DEBUG road ${id} Pushed geometry object: ${JSON.stringify(geometryObject)}`);
                }
            } else {
                if (debugIDs.includes(id)) {
                    this.logger.warn(`ParserWorker: DEBUG road ${id} One or more critical geometry attributes are null. s=${s}, x=${x}, y=${y}, hdg=${hdg}, length=${geomLength}`);
                }
            }
        } else {
            if (debugIDs.includes(id)) {
                // 상세 로그는 위에서 이미 처리했으므로, 여기서는 간단히 남기거나 제거 가능
                this.logger.warn(`ParserWorker: DEBUG road ${id} No geometryMatch found (re-confirming after detailed log).`);
            }
        }

        let predecessor = null;
        const predMatch = roadXmlString.match(/<predecessor([^>]*)>/);
        if (predMatch) {
            predecessor = {
                elementType: getAttribute(predMatch[1], 'elementType'),
                elementId: getAttribute(predMatch[1], 'elementId'),
                contactPoint: getAttribute(predMatch[1], 'contactPoint'),
            };
        }

        let successor = null;
        const succMatch = roadXmlString.match(/<successor([^>]*)>/);
        if (succMatch) {
            successor = {
                elementType: getAttribute(succMatch[1], 'elementType'),
                elementId: getAttribute(succMatch[1], 'elementId'),
                contactPoint: getAttribute(succMatch[1], 'contactPoint'),
            };
        }

        const roadObject = {
            id: id,
            name: name || '',
            length: length ? parseFloat(length) : 0,
            junction: junction || '-1',
            needsDetails: true, 
            rawRoadElementContent: roadXmlString, 
            predecessor: predecessor,
            successor: successor,
            planView: planView
        };

        if (debugIDs.includes(id)) {
            // 로그 메시지를 (geometry skipped) 에서 (geometry parsing attempted) 등으로 변경 가능
            this.logger.log(`ParserWorker: DEBUG road ${id} (geometry parsing attempted) Parsed Object: ${JSON.stringify(roadObject, null, 1)}`);
        }
        return roadObject;
    }
}
// --- OpenDriveParser 클래스 코드 끝 ---

// Worker 전역 에러 핸들러
self.onerror = function(message, source, lineno, colno, error) {
    // this.logger 사용 불가 (self 컨텍스트의 logger는 OpenDriveParser 인스턴스 내에 있음)
    // 직접 postMessage로 에러 전송
    self.postMessage({
        type: 'error', // 'log' 타입, level 'error' 대신 명시적 'error' 타입 사용 가능 (메인 핸들러와 일치시키기)
        level: 'error', // 또는 level 정보를 유지
        timestamp: new Date().toISOString(),
        message: `WORKER SCRIPT ERROR: ${message} (Source: ${source}, Line: ${lineno}, Col: ${colno})`,
        stack: error ? error.stack : 'No stack available'
    });
    return false; // true로 하면 에러가 전파되지 않음 (콘솔에 안 찍힐 수 있음)
};

// 지오메트리 계산 함수들
function calculateLinePoints(startX, startY, heading, length, pointInterval) {
    const points = [];
    for (let s = 0; s <= length; s += pointInterval) {
        const x = startX + s * Math.cos(heading);
        const y = startY + s * Math.sin(heading);
        points.push({ x, y });
    }
    return points;
}

function calculateArcPoints(startX, startY, heading, length, curvature, pointInterval) {
    const points = [];
    const radius = 1 / curvature;
    const angle = length * curvature;
    
    for (let s = 0; s <= length; s += pointInterval) {
        const currentAngle = s * curvature;
        const x = startX + radius * (Math.sin(heading + currentAngle) - Math.sin(heading));
        const y = startY + radius * (-Math.cos(heading + currentAngle) + Math.cos(heading));
        points.push({ x, y });
    }
    return points;
}

function calculateSpiralPoints(startX, startY, heading, length, curvStart, curvEnd, pointInterval) {
    const points = [];
    const n = Math.ceil(length / pointInterval);
    const ds = length / n;
    
    for (let i = 0; i <= n; i++) {
        const s = i * ds;
        const curvature = curvStart + (curvEnd - curvStart) * s / length;
        const radius = 1 / curvature;
        const angle = s * curvature;
        
        const x = startX + radius * (Math.sin(heading + angle) - Math.sin(heading));
        const y = startY + radius * (-Math.cos(heading + angle) + Math.cos(heading));
        points.push({ x, y });
    }
    return points;
}

// 메인 스레드로부터 메시지를 수신하고 처리하는 핸들러
self.onmessage = async function(event) {
    const { type, data } = event.data;
    
    try {
        switch(type) {
            case 'PARSE_INITIAL':
                if (!parser) {
                    parser = new OpenDriveParser();
                }
                
                // 초기 파싱 수행
                const initialData = parser.parse(data);
                
                // 메인 스레드로 결과 전송
                self.postMessage({
                    type: 'INITIAL_PARSED',
                    data: initialData
                });
                break;
                
            case 'PARSE_ROAD_DETAILS':
                if (!parser) {
                    throw new Error('Parser not initialized');
                }
                
                // 도로 상세 정보 파싱
                const roadDetails = parser.parseRoadDetails(data);
                
                // 메인 스레드로 결과 전송
                self.postMessage({
                    type: 'ROAD_DETAILS_PARSED',
                    data: roadDetails
                });
                break;
            
            case 'CALCULATE_GEOMETRY':
                const { geometryType, params } = data;
                let points;
                
                switch(geometryType) {
                    case 'line':
                        points = calculateLinePoints(
                            params.startX,
                            params.startY,
                            params.heading,
                            params.length,
                            params.pointInterval
                        );
                        break;
                        
                    case 'arc':
                        points = calculateArcPoints(
                            params.startX,
                            params.startY,
                            params.heading,
                            params.length,
                            params.curvature,
                            params.pointInterval
                        );
                        break;
                        
                    case 'spiral':
                        points = calculateSpiralPoints(
                            params.startX,
                            params.startY,
                            params.heading,
                            params.length,
                            params.curvStart,
                            params.curvEnd,
                            params.pointInterval
                        );
                        break;
                }
                
                self.postMessage({ 
                    type: 'GEOMETRY_CALCULATED', 
                    data: { 
                        geometryType,
                        points 
                    }
                });
                break;
        }
    } catch (error) {
        self.postMessage({
            type: 'PARSE_ERROR',
            data: {
                message: error.message
            }
        });
    }
};

// 이 로그는 워커 스크립트가 평가될 때 한 번 실행되어 onmessage 핸들러가 설정되었음을 알림
// 단, OpenDriveParser 인스턴스 생성 전이므로 parser.logger는 아직 사용 불가.
// 직접 console.log 또는 postMessage 사용.
self.postMessage({type: 'log', level: 'info', message: "ParserWorker: onmessage handler registered and ready to receive messages."});
console.log("[WorkerLOG] ParserWorker: onmessage handler registered.");

console.log('[WorkerLOG] ParserWorker: Script bottom-level. Event handlers (onmessage, onerror) are set up.'); 