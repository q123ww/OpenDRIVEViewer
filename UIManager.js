import { DebugLogger } from './DebugLogger.js';

export class UIManager {
    constructor(uiElements, logger) {
        this.logger = logger;
        this.logger.log('Initializing UIManager...');

        // UI 요소 참조 저장
        this.fileInput = document.getElementById(uiElements.fileInputId);
        this.loadDefaultBtn = document.getElementById(uiElements.loadDefaultBtnId);
        this.toggleReferenceLinesBtn = document.getElementById(uiElements.toggleReferenceLinesBtnId);
        this.roadList = document.getElementById(uiElements.roadListId);
        this.loadingIndicator = document.getElementById(uiElements.loadingIndicatorId);
        this.loadingProgress = this.loadingIndicator.querySelector('.loading-progress');

        // UI 요소가 모두 존재하는지 확인
        if (!this.fileInput || !this.loadDefaultBtn || !this.toggleReferenceLinesBtn || 
            !this.roadList || !this.loadingIndicator || !this.loadingProgress) {
            throw new Error('Required UI elements not found');
        }

        this.logger.log('UIManager initialization complete');
    }

    showLoading(show) {
        this.loadingIndicator.style.display = show ? 'flex' : 'none';
    }

    updateLoadingProgress(percent) {
        this.loadingProgress.textContent = `${Math.round(percent)}%`;
    }

    showError(message) {
        alert(message); // 임시로 alert 사용, 나중에 더 나은 UI로 개선
    }

    clearRoadList() {
        this.roadList.innerHTML = '';
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
            this.roadList.appendChild(roadElement);
        });
    }

    updateRoadStatus(roadId, status) {
        const roadElement = this.roadList.querySelector(`[data-road-id="${roadId}"]`);
        if (roadElement) {
            roadElement.querySelector('.road-status').textContent = status;
        }
    }
} 