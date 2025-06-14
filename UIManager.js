import { DebugLogger } from './DebugLogger.js';

export class UIManager {
    constructor(logger, uiElements) {
        this.logger = logger;
        this.logger.log('Initializing UIManager...');
        this.uiElements = uiElements;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 파일 입력 이벤트
        this.uiElements.fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.logger.log(`File selected: ${file.name}`);
                // 파일 처리 로직은 OpenDriveViewer에서 처리
            }
        });

        // 기본 파일 로드 버튼
        this.uiElements.loadDefaultBtn.addEventListener('click', () => {
            this.logger.log('Loading default file...');
            // 기본 파일 로드 로직은 OpenDriveViewer에서 처리
        });

        // Reference 라인 토글
        this.uiElements.toggleReferenceLinesBtn.addEventListener('click', () => {
            this.logger.log('Toggling reference lines...');
            // Reference 라인 토글 로직은 OpenDriveViewer에서 처리
        });

        // 레인 타입 표시 제어
        this.uiElements.showDrivingLanes.addEventListener('change', (e) => {
            this.logger.log(`Driving lanes visibility: ${e.target.checked}`);
            // 레인 표시 로직은 OpenDriveViewer에서 처리
        });

        this.uiElements.showBorderLanes.addEventListener('change', (e) => {
            this.logger.log(`Border lanes visibility: ${e.target.checked}`);
            // 레인 표시 로직은 OpenDriveViewer에서 처리
        });

        this.uiElements.showSidewalkLanes.addEventListener('change', (e) => {
            this.logger.log(`Sidewalk lanes visibility: ${e.target.checked}`);
            // 레인 표시 로직은 OpenDriveViewer에서 처리
        });
    }

    showLoading() {
        this.uiElements.loadingIndicator.style.display = 'flex';
    }

    hideLoading() {
        this.uiElements.loadingIndicator.style.display = 'none';
    }

    updateRoadList(roads) {
        const roadList = this.uiElements.roadList;
        roadList.innerHTML = '';
        
        roads.forEach(road => {
            const item = document.createElement('div');
            item.className = 'road-item';
            item.textContent = `Road ${road.id}`;
            item.addEventListener('click', () => {
                this.logger.log(`Selected road: ${road.id}`);
                // 도로 선택 로직은 OpenDriveViewer에서 처리
            });
            roadList.appendChild(item);
        });
    }

    showError(message) {
        alert(message);
    }

    showLoading(show) {
        this.uiElements.loadingIndicator.style.display = show ? 'flex' : 'none';
    }

    updateLoadingProgress(percent) {
        const loadingProgress = this.uiElements.loadingIndicator.querySelector('.loading-progress');
        if (loadingProgress) {
            loadingProgress.textContent = `${Math.round(percent)}%`;
        }
    }

    clearRoadList() {
        this.uiElements.roadList.innerHTML = '';
    }

    populateRoadList(roads) {
        this.clearRoadList();
        roads.forEach(road => {
            const roadElement = document.createElement('div');
            roadElement.className = 'road-item';
            roadElement.innerHTML = `
                <span class="road-name">${road.name}</span>
                <span class="road-length">${road.length.toFixed(2)}m</span>
                <span class="road-status">${road.status}</span>
            `;
            this.uiElements.roadList.appendChild(roadElement);
        });
    }

    updateRoadStatus(roadId, status) {
        const roadElement = this.uiElements.roadList.querySelector(`[data-road-id="${roadId}"]`);
        if (roadElement) {
            roadElement.querySelector('.road-status').textContent = status;
        }
    }

    // 간단한 도로 정보 표시 (추후 패널 UI로 개선 가능)
    showRoadInfo(roadData) {
        const { roadId, length, laneId, x, y } = roadData;
        let msg = `Road ID: ${roadId}`;
        if (length !== undefined) msg += ` | Len: ${length.toFixed(1)} m`;
        if (laneId !== undefined) msg += ` | Lane: ${laneId}`;
        if (x !== undefined && y !== undefined) msg += `\nX: ${x.toFixed(1)} m, Y: ${y.toFixed(1)} m`;
        // center screen
        const cx = window.innerWidth / 2;
        const cy = 20;
        this.showTooltip(msg, cx, cy);
    }

    // Tooltip 모양 간단 구현 (optional used by SceneManager)
    showTooltip(text, x, y) {
        if (!this.tooltipEl) {
            this.tooltipEl = document.createElement('div');
            this.tooltipEl.style.position = 'fixed';
            this.tooltipEl.style.padding = '4px 8px';
            this.tooltipEl.style.background = 'rgba(0,0,0,0.7)';
            this.tooltipEl.style.color = '#fff';
            this.tooltipEl.style.borderRadius = '4px';
            this.tooltipEl.style.pointerEvents = 'none';
            this.tooltipEl.style.zIndex = '1000';
            document.body.appendChild(this.tooltipEl);
        }
        this.tooltipEl.textContent = text;
        this.tooltipEl.style.left = `${x}px`;
        this.tooltipEl.style.top = `${y}px`;
        this.tooltipEl.style.display = 'block';
    }

    updateTooltipPosition(x, y) {
        if (this.tooltipEl) {
            this.tooltipEl.style.left = `${x}px`;
            this.tooltipEl.style.top = `${y}px`;
        }
    }

    hideTooltip() {
        if (this.tooltipEl) {
            this.tooltipEl.style.display = 'none';
        }
    }
} 