const funMessages = [
    "Teaching pixels to be smaller...",
    "Compressing the digital universe...",
    "Reticulating splines, one frame at a time...",
    "Don't worry, the hamster powering our server is getting a water break.",
    "Polishing each frame to sparkling perfection...",
    "Finding a smaller home for your video's data...",
    "This is not magic, it's just very clever math.",
    "Converting... Did you know a group of pugs is called a grumble?",
    "Making your video web-friendly and lightning-fast!",
    "Almost there... brewing a fresh pot of coffee for the next one."
];

class HTML5VideoConverter {
    constructor() {
        this.state = {
            files: [],
            isProcessing: false,
            aspectRatio: 1,
            funTextIntervalId: null,
        };
        this.elements = this.initializeElements();
        this.initializeEventListeners();
    }

    initializeElements() {
        return {
            uploadContainer: document.getElementById('upload-container'),
            fileInput: document.getElementById('file-input'),
            controlsSection: document.getElementById('controls-section'),
            widthInput: document.getElementById('width-input'),
            heightInput: document.getElementById('height-input'),
            bitrateSelect: document.getElementById('bitrate-select'),
            formatSelect: document.getElementById('format-select'),
            removeAudio: document.getElementById('remove-audio'),
            maintainAspectRatio: document.getElementById('maintain-aspect-ratio'),
            processBtn: document.getElementById('process-btn'),
            resetBtn: document.getElementById('reset-btn'),
            downloadZipBtn: document.getElementById('download-zip-btn'),
            videoQueueSection: document.getElementById('video-queue-section'),
            videoGrid: document.getElementById('video-grid'),
            videoCount: document.getElementById('video-count'),
            errorMessage: document.getElementById('error-message'),
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingText: document.getElementById('loading-text'),
            funFactText: document.getElementById('fun-fact-text'), // This is unused now, but harmless to keep
            totalStatsSection: document.getElementById('total-stats-section'),
            totalOriginalSize: document.getElementById('total-original-size'),
            totalNewSize: document.getElementById('total-new-size'),
            totalSavingsPercent: document.getElementById('total-savings-percent'),
        };
    }

    initializeEventListeners() {
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
        this.setupDragAndDrop();
        this.elements.widthInput.addEventListener('input', () => this.handleDimensionChange('width'));
        this.elements.heightInput.addEventListener('input', () => this.handleDimensionChange('height'));
        this.elements.processBtn.addEventListener('click', () => this.processAllVideos());
        this.elements.resetBtn.addEventListener('click', () => this.resetApplication());
        this.elements.downloadZipBtn.addEventListener('click', () => this.downloadAllAsZip());
        this.elements.videoGrid.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            const card = target.closest('.video-card');
            const fileId = card.dataset.id;
            if (target.classList.contains('download-btn')) this.downloadSingleVideo(fileId);
            if (target.classList.contains('remove-btn')) this.removeVideo(fileId);
        });
    }

    setupDragAndDrop() {
        const dropZone = this.elements.uploadContainer;
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false));
        ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false));
        ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false));
        dropZone.addEventListener('drop', (e) => this.handleFileSelect(e.dataTransfer.files), false);
    }

    async handleFileSelect(files) {
        if (!files || files.length === 0) return;
        this.showLoading(true, `Loading ${files.length} video(s)...`);
        const filePromises = Array.from(files).map(file => this.processFile(file)).filter(p => p);
        await Promise.all(filePromises);
        this.renderVideoGrid();
        this.updateUIState();
        this.showLoading(false);
    }

    processFile(file) {
        if (!file.type.match(/^video\/.+/i)) {
            this.showError(`${file.name} is not a valid video file.`);
            return null;
        }
        return new Promise(resolve => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = async () => {
                const thumbnailUrl = await this.generateThumbnail(video);
                const fileObj = {
                    id: `${file.name}-${file.size}-${Date.now()}`,
                    file,
                    original: { width: video.videoWidth, height: video.videoHeight, thumbnailUrl, size: file.size },
                    status: 'pending',
                    processed: null,
                };
                this.state.files.push(fileObj);
                if (this.state.files.length === 1) this.setDefaultDimensions(video);
                resolve();
            };
            video.onerror = () => { this.showError(`Could not read metadata for ${file.name}`); resolve(); };
            video.src = URL.createObjectURL(file);
        });
    }

    generateThumbnail(video) {
        return new Promise(resolve => {
            const canvas = document.createElement('canvas');
            video.onseeked = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                resolve(canvas.toDataURL('image/jpeg'));
                URL.revokeObjectURL(video.src);
            };
            video.currentTime = Math.min(1, video.duration / 2);
        });
    }

    setDefaultDimensions(video) {
        this.state.aspectRatio = video.videoWidth / video.videoHeight;
        this.elements.widthInput.value = video.videoWidth;
        this.elements.heightInput.value = video.videoHeight;
    }

    updateUIState() {
        const hasFiles = this.state.files.length > 0;
        const hasConvertedFiles = this.state.files.some(f => f.status === 'done');
        this.elements.controlsSection.style.display = hasFiles ? 'block' : 'none';
        this.elements.videoQueueSection.style.display = hasFiles ? 'block' : 'none';
        this.elements.processBtn.disabled = !this.state.files.some(f => f.status === 'pending') || this.state.isProcessing;
        this.elements.videoCount.textContent = this.state.files.length;
        this.elements.downloadZipBtn.style.display = hasConvertedFiles ? 'inline-flex' : 'none';
        this.elements.totalStatsSection.style.display = hasConvertedFiles ? 'block' : 'none';
    }

    renderVideoGrid() {
        this.elements.videoGrid.innerHTML = '';
        this.state.files.forEach(fileObj => {
            const card = document.createElement('div');
            card.className = `video-card status-border-${fileObj.status}`;
            card.dataset.id = fileObj.id;
            const originalSize = this.formatFileSize(fileObj.original.size);
            let statusHTML;
            if (fileObj.status === 'processing') {
                statusHTML = `
                    <div class="video-processing-state">
                        <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: 0%;"></div>
                        </div>
                        <p class="progress-text">Initializing...</p>
                    </div>`;
            } else if (fileObj.status === 'done' && fileObj.processed) {
                const processedSize = this.formatFileSize(fileObj.processed.blob.size);
                const savings = 100 - (fileObj.processed.blob.size / fileObj.original.size) * 100;
                statusHTML = `
                    <div class="video-card-player">
                        <video src="${fileObj.processed.url}" controls muted loop></video>
                    </div>
                    <div class="video-results">
                        <p><strong>New Size:</strong> ${processedSize}</p>
                        <p class="size-savings"><strong>Savings: ${savings.toFixed(1)}%</strong></p>
                    </div>`;
            } else {
                statusHTML = `<span class="status-badge status-${fileObj.status}">${fileObj.status}</span>`;
            }
            card.innerHTML = `
                <div class="video-thumbnail">
                    <img src="${fileObj.original.thumbnailUrl}" alt="Thumbnail for ${fileObj.file.name}">
                </div>
                <div class="video-info">
                    <p class="video-filename">${fileObj.file.name}</p>
                    <p class="video-stats">${fileObj.original.width}×${fileObj.original.height}px (${originalSize})</p>
                    ${statusHTML}
                    <div class="video-actions">
                        <button class="btn btn-secondary remove-btn">Remove</button>
                        <button class="btn btn-success download-btn" style="display: ${fileObj.processed ? 'flex' : 'none'}">Download</button>
                    </div>
                </div>`;
            this.elements.videoGrid.appendChild(card);
        });
    }
    
    handleDimensionChange(dimension) {
        if (!this.state.aspectRatio || !this.elements.maintainAspectRatio.checked) return;
        const widthInput = this.elements.widthInput;
        const heightInput = this.elements.heightInput;
        if (dimension === 'width') {
            const newWidth = parseInt(widthInput.value, 10) || 0;
            heightInput.value = Math.round(newWidth / this.state.aspectRatio);
        } else {
            const newHeight = parseInt(heightInput.value, 10) || 0;
            widthInput.value = Math.round(newHeight * this.state.aspectRatio);
        }
    }

    async processAllVideos() {
        if (this.state.isProcessing) return;
        this.state.isProcessing = true;
        this.updateUIState();
        const filesToProcess = this.state.files.filter(f => f.status === 'pending');
        for (const [index, fileObj] of filesToProcess.entries()) {
            fileObj.status = 'processing';
            this.renderVideoGrid();
            const progressCallback = (progress) => {
                this.showLoading(true, `Processing ${index + 1}/${filesToProcess.length}: ${fileObj.file.name} (${progress}%)`);
                const cardEl = this.elements.videoGrid.querySelector(`[data-id="${fileObj.id}"]`);
                if (cardEl) {
                    const fillEl = cardEl.querySelector('.progress-bar-fill');
                    const textEl = cardEl.querySelector('.progress-text');
                    if (fillEl) fillEl.style.width = `${progress}%`;
                    if (textEl) textEl.textContent = `Processing... ${progress}%`;
                }
            };
            try {
                const processedBlob = await this.performHtml5Conversion(fileObj.file, progressCallback);
                fileObj.processed = { blob: processedBlob, url: URL.createObjectURL(processedBlob) };
                fileObj.status = 'done';
            } catch (error) {
                console.error('Conversion failed:', error);
                fileObj.status = 'error';
                this.showError(`Failed to convert ${fileObj.file.name}. ${error.message}`);
            }
            this.renderVideoGrid();
        }
        this.state.isProcessing = false;
        this.showLoading(false);
        this.updateTotalStats();
        this.updateUIState();
    }

    performHtml5Conversion(file, onProgress) {
        return new Promise((resolve, reject) => {
            const width = parseInt(this.elements.widthInput.value, 10);
            const height = parseInt(this.elements.heightInput.value, 10);
            const bitrate = parseInt(this.elements.bitrateSelect.value, 10);
            const mimeType = this.elements.formatSelect.value;
            const removeAudio = this.elements.removeAudio.checked;
            if (!MediaRecorder.isTypeSupported(mimeType)) return reject(new Error(`${mimeType} format is not supported by your browser.`));
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = width; canvas.height = height;
            video.src = URL.createObjectURL(file);
            video.muted = true;
            video.onloadedmetadata = () => {
                const canvasStream = canvas.captureStream(30);
                let finalStream = canvasStream;
                if (!removeAudio && (video.mozHasAudio || video.webkitHasAudio || video.audioTracks?.length > 0)) {
                    const audioContext = new AudioContext();
                    const sourceNode = audioContext.createMediaElementSource(video);
                    const destNode = audioContext.createMediaStreamDestination();
                    sourceNode.connect(destNode);
                    if (destNode.stream.getAudioTracks().length > 0) finalStream.addTrack(destNode.stream.getAudioTracks()[0]);
                }
                const recorder = new MediaRecorder(finalStream, { mimeType, videoBitsPerSecond: bitrate });
                const chunks = [];
                recorder.ondataavailable = e => chunks.push(e.data);
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    URL.revokeObjectURL(video.src);
                    resolve(blob);
                };
                recorder.onerror = e => reject(e.error);
                let frameId, lastProgress = -1;
                const drawFrame = () => {
                    if (video.paused || video.ended) {
                        cancelAnimationFrame(frameId);
                        recorder.stop();
                        return;
                    }
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const progress = Math.min(100, Math.round((video.currentTime / video.duration) * 100));
                    if (progress > lastProgress) {
                        onProgress(progress);
                        lastProgress = progress;
                    }
                    frameId = requestAnimationFrame(drawFrame);
                };
                video.play().then(() => { recorder.start(); drawFrame(); }).catch(reject);
            };
            video.onerror = (e) => reject(new Error('Could not load the video file. It might be corrupt or in an unsupported format.'));
        });
    }

    async downloadAllAsZip() {
        const convertedFiles = this.state.files.filter(f => f.status === 'done' && f.processed);
        if (convertedFiles.length === 0) return;
        this.showLoading(true, `Zipping ${convertedFiles.length} files...`);
        try {
            const zip = new JSZip();
            convertedFiles.forEach(fileObj => {
                zip.file(this.generateFilename(fileObj.file), fileObj.processed.blob);
            });
            const content = await zip.generateAsync({ type: 'blob' });
            this.triggerDownload(URL.createObjectURL(content), `converted-videos-${Date.now()}.zip`);
        } catch (error) {
            console.error('Zipping failed:', error);
            this.showError('There was an error creating the ZIP file.');
        } finally {
            this.showLoading(false);
        }
    }

    downloadSingleVideo(fileId) {
        const fileObj = this.state.files.find(f => f.id === fileId);
        if (!fileObj || !fileObj.processed) return;
        this.triggerDownload(fileObj.processed.url, this.generateFilename(fileObj.file));
    }

    triggerDownload(href, filename) {
        const link = document.createElement('a');
        link.href = href; link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    generateFilename(originalFile) {
        const extension = this.elements.formatSelect.value.split('/')[1];
        const originalName = originalFile.name.substring(0, originalFile.name.lastIndexOf('.'));
        return `${originalName}-converted.${extension}`;
    }

    removeVideo(fileId) {
        const fileObj = this.state.files.find(f => f.id === fileId);
        if (fileObj?.processed?.url) URL.revokeObjectURL(fileObj.processed.url);
        this.state.files = this.state.files.filter(f => f.id !== fileId);
        this.renderVideoGrid();
        this.updateTotalStats();
        this.updateUIState();
    }

    resetApplication() {
        if (this.state.files.length > 0 && !confirm('Are you sure? This will clear all videos.')) return;
        this.state.files.forEach(f => { if (f.processed?.url) URL.revokeObjectURL(f.processed.url); });
        this.state = { ...this.state, files: [] };
        this.elements.fileInput.value = '';
        this.renderVideoGrid();
        this.updateTotalStats();
        this.updateUIState();
    }
    
    updateTotalStats() {
        const convertedFiles = this.state.files.filter(f => f.status === 'done' && f.processed);
        let totalOriginalSize = 0;
        let totalNewSize = 0;
        convertedFiles.forEach(f => {
            totalOriginalSize += f.original.size;
            totalNewSize += f.processed.blob.size;
        });
        this.elements.totalOriginalSize.textContent = this.formatFileSize(totalOriginalSize);
        this.elements.totalNewSize.textContent = this.formatFileSize(totalNewSize);
        const savings = totalOriginalSize > 0 ? 100 - (totalNewSize / totalOriginalSize) * 100 : 0;
        this.elements.totalSavingsPercent.textContent = `${savings.toFixed(1)}%`;
    }

    showError(message) { this.elements.errorMessage.textContent = message; this.elements.errorMessage.style.display = 'block'; setTimeout(() => this.elements.errorMessage.style.display = 'none', 5000); }
    showLoading(show, text = 'Processing...') { this.elements.loadingText.textContent = text; this.elements.loadingOverlay.classList.toggle('visible', show); }
    formatFileSize(bytes) { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; }
}

document.addEventListener('DOMContentLoaded', () => {
    window.html5VideoConverter = new HTML5VideoConverter();
});