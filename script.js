class VideoOptimizerPro {
    constructor() {
        this.state = {
            files: [], // { id, file, original, status, processed }
            isProcessing: false,
            ffmpegReady: false,
            ffmpeg: null,
            aspectRatio: 1,
        };

        this.elements = this.initializeElements();
        this.initializeEventListeners();
        this.loadFfmpeg();
    }

    initializeElements() {
        return {
            uploadContainer: document.getElementById('upload-container'),
            fileInput: document.getElementById('file-input'),
            controlsSection: document.getElementById('controls-section'),
            widthInput: document.getElementById('width-input'),
            heightInput: document.getElementById('height-input'),
            qualitySelect: document.getElementById('quality-select'),
            formatSelect: document.getElementById('format-select'),
            removeAudio: document.getElementById('remove-audio'),
            maintainAspectRatio: document.getElementById('maintain-aspect-ratio'),
            processBtn: document.getElementById('process-btn'),
            resetBtn: document.getElementById('reset-btn'),
            videoQueueSection: document.getElementById('video-queue-section'),
            videoGrid: document.getElementById('video-grid'),
            videoCount: document.getElementById('video-count'),
            errorMessage: document.getElementById('error-message'),
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingText: document.getElementById('loading-text'),
        };
    }

    async loadFfmpeg() {
        this.showLoading(true, 'Initializing Video Engine (this may take a moment)...');
        try {
            this.state.ffmpeg = FFmpeg.createFFmpeg({ log: true });
            await this.state.ffmpeg.load();
            this.state.ffmpegReady = true;
            this.showLoading(false);
        } catch (error) {
            console.error(error);
            this.showError('Failed to load the video engine. Please try refreshing the page.');
            this.showLoading(false);
        }
    }

    initializeEventListeners() {
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
        this.setupDragAndDrop();
        
        this.elements.widthInput.addEventListener('input', () => this.handleDimensionChange('width'));
        this.elements.heightInput.addEventListener('input', () => this.handleDimensionChange('height'));
        
        this.elements.processBtn.addEventListener('click', () => this.processAllVideos());
        this.elements.resetBtn.addEventListener('click', () => this.resetApplication());

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
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
        });
        dropZone.addEventListener('drop', (e) => this.handleFileSelect(e.dataTransfer.files), false);
    }

    async handleFileSelect(files) {
        if (!files || files.length === 0) return;
        if (!this.state.ffmpegReady) {
            this.showError('Video engine is not ready. Please wait.');
            return;
        }
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
        
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = async () => {
                window.URL.revokeObjectURL(video.src);
                const thumbnail = await this.generateThumbnail(video);

                const fileObj = {
                    id: `${file.name}-${file.size}-${Date.now()}`,
                    file,
                    original: {
                        width: video.videoWidth,
                        height: video.videoHeight,
                        thumbnailUrl: thumbnail,
                    },
                    status: 'pending', // pending, processing, done, error
                    processed: null, // { url, size }
                };

                this.state.files.push(fileObj);
                if (this.state.files.length === 1) this.setDefaultDimensions(video);
                resolve();
            };
            video.onerror = () => { this.showError(`Could not read metadata for ${file.name}`); resolve(); };
            video.src = window.URL.createObjectURL(file);
        });
    }

    generateThumbnail(video) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            video.onseeked = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                resolve(canvas.toDataURL('image/jpeg'));
            };
            video.currentTime = Math.min(1, video.duration / 2); // Seek to 1s or midpoint
        });
    }

    setDefaultDimensions(video) {
        this.state.aspectRatio = video.videoWidth / video.videoHeight;
        this.elements.widthInput.value = video.videoWidth;
        this.elements.heightInput.value = video.videoHeight;
    }

    updateUIState() {
        const hasFiles = this.state.files.length > 0;
        this.elements.controlsSection.style.display = hasFiles ? 'block' : 'none';
        this.elements.videoQueueSection.style.display = hasFiles ? 'block' : 'none';
        this.elements.processBtn.disabled = !this.state.files.some(f => f.status === 'pending') || this.state.isProcessing;
        this.elements.videoCount.textContent = this.state.files.length;
    }

    renderVideoGrid() {
        this.elements.videoGrid.innerHTML = '';
        this.state.files.forEach(fileObj => {
            const card = document.createElement('div');
            card.className = 'video-card';
            card.dataset.id = fileObj.id;
            
            const statusClass = `status-${fileObj.status}`;
            const originalSize = this.formatFileSize(fileObj.file.size);
            const processedSize = fileObj.processed ? this.formatFileSize(fileObj.processed.size) : '?';

            card.innerHTML = `
                <div class="video-thumbnail">
                    <img src="${fileObj.original.thumbnailUrl}" alt="Thumbnail for ${fileObj.file.name}">
                </div>
                <div class="video-info">
                    <p class="video-filename">${fileObj.file.name}</p>
                    <p class="video-stats">
                        ${fileObj.original.width}×${fileObj.original.height}px (${originalSize}) → ${fileObj.status === 'done' ? processedSize : '?'}
                    </p>
                    <span class="status-badge ${statusClass}">${fileObj.status}</span>
                    <div class="video-actions">
                        <button class="btn btn-secondary remove-btn">Remove</button>
                        <button class="btn btn-success download-btn" style="display: ${fileObj.processed ? 'flex' : 'none'}">Download</button>
                    </div>
                </div>
            `;
            this.elements.videoGrid.appendChild(card);
        });
    }

    handleDimensionChange(dimension) {
        if (!this.state.aspectRatio || !this.elements.maintainAspectRatio.checked) return;
        if (dimension === 'width') {
            const newWidth = parseInt(this.elements.widthInput.value) || 0;
            this.elements.heightInput.value = Math.round(newWidth / this.state.aspectRatio);
        } else {
            const newHeight = parseInt(this.elements.heightInput.value) || 0;
            this.elements.widthInput.value = Math.round(newHeight * this.state.aspectRatio);
        }
    }

    async processAllVideos() {
        if (this.state.isProcessing) return;
        this.state.isProcessing = true;
        this.updateUIState();

        const filesToProcess = this.state.files.filter(f => f.status === 'pending');
        let processedCount = 0;

        for (const fileObj of filesToProcess) {
            processedCount++;
            fileObj.status = 'processing';
            this.renderVideoGrid();
            
            this.state.ffmpeg.setLogger(({ type, message }) => {
                // We could parse the message for progress, but a simple message is fine for now
                console.log(type, message);
            });
            
            this.state.ffmpeg.setProgress(({ ratio }) => {
                const percent = Math.round(ratio * 100);
                this.showLoading(true, `Processing ${processedCount}/${filesToProcess.length}: ${fileObj.file.name} (${percent}%)`);
            });
            
            try {
                const processedData = await this.performOptimization(fileObj.file);
                fileObj.processed = {
                    url: URL.createObjectURL(new Blob([processedData.buffer], { type: `video/${this.elements.formatSelect.value}` })),
                    size: processedData.length
                };
                fileObj.status = 'done';
            } catch (error) {
                console.error(error);
                fileObj.status = 'error';
                this.showError(`Failed to process ${fileObj.file.name}`);
            }
            this.renderVideoGrid();
        }

        this.state.isProcessing = false;
        this.showLoading(false);
        this.updateUIState();
    }

    async performOptimization(file) {
        const { ffmpeg } = this.state;
        const inputFilename = file.name;
        const outputFormat = this.elements.formatSelect.value;
        const outputFilename = `output.${outputFormat}`;

        // Write file to FFmpeg's virtual file system
        ffmpeg.FS('writeFile', inputFilename, await FFmpeg.fetchFile(file));

        const width = this.elements.widthInput.value;
        const height = this.elements.heightInput.value;
        const quality = this.elements.qualitySelect.value;
        const removeAudio = this.elements.removeAudio.checked;

        // Map quality presets to FFmpeg's CRF (Constant Rate Factor) values. Lower is better quality.
        const crfMap = {
            'mp4': { 'high': 18, 'medium': 23, 'low': 28 },
            'webm': { 'high': 20, 'medium': 28, 'low': 35 }
        };
        const codecMap = { 'mp4': 'libx264', 'webm': 'libvpx-vp9' };
        
        const command = [
            '-i', inputFilename,
            '-c:v', codecMap[outputFormat],
            '-vf', `scale=${width}:${height}`,
            '-crf', crfMap[outputFormat][quality].toString(),
            '-preset', 'medium', // Balances encoding speed and compression
            '-pix_fmt', 'yuv420p', // Important for browser compatibility
        ];

        if (removeAudio) {
            command.push('-an'); // -an flag removes audio
        } else {
            command.push('-c:a', 'aac', '-b:a', '128k'); // Add audio codec if not removed
        }

        command.push(outputFilename);
        
        await ffmpeg.run(...command);

        const data = ffmpeg.FS('readFile', outputFilename);
        ffmpeg.FS('unlink', inputFilename);
        ffmpeg.FS('unlink', outputFilename);
        
        return data;
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
        const format = this.elements.formatSelect.value;
        const originalName = originalFile.name.substring(0, originalFile.name.lastIndexOf('.'));
        return `${originalName}-optimized.${format}`;
    }
  
    removeVideo(fileId) {
        const fileObj = this.state.files.find(f => f.id === fileId);
        if (fileObj && fileObj.processed && fileObj.processed.url) {
            URL.revokeObjectURL(fileObj.processed.url); // Clean up blob URL
        }
        this.state.files = this.state.files.filter(f => f.id !== fileId);
        this.renderVideoGrid();
        this.updateUIState();
    }

    resetApplication() {
        if (this.state.files.length > 0 && !confirm('Are you sure? This will clear all videos.')) return;
        this.state.files.forEach(fileObj => {
             if (fileObj.processed && fileObj.processed.url) {
                URL.revokeObjectURL(fileObj.processed.url);
             }
        });
        this.state.files = [];
        this.elements.fileInput.value = '';
        this.elements.widthInput.value = '';
        this.elements.heightInput.value = '';
        this.renderVideoGrid();
        this.updateUIState();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showError(message) { this.elements.errorMessage.textContent = message; this.elements.errorMessage.style.display = 'block'; setTimeout(() => this.elements.errorMessage.style.display = 'none', 5000); }
    showLoading(show, text = 'Processing...') { this.elements.loadingText.textContent = text; this.elements.loadingOverlay.classList.toggle('visible', show); }
    formatFileSize(bytes) { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; }
}

document.addEventListener('DOMContentLoaded', () => {
    window.videoOptimizerPro = new VideoOptimizerPro();
});