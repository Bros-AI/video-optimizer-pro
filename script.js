class MediaConverter {
    constructor() {
        this.ffmpeg = null;
        this.isLoaded = false;
        this.currentFile = null;
        this.initializeElements();
        this.attachEventListeners();
        this.loadFFmpeg();
    }

    initializeElements() {
        this.fileInput = document.getElementById('fileInput');
        this.conversionOptions = document.getElementById('conversionOptions');
        this.convertBtn = document.getElementById('convertBtn');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.outputSection = document.getElementById('outputSection');
        this.downloadLink = document.getElementById('downloadLink');
    }

    async loadFFmpeg() {
        try {
            console.log('Loading FFmpeg with local compatibility mode...');
            
            // Create script element to load FFmpeg UMD version (works better locally)
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
            script.crossOrigin = 'anonymous';
            
            // Wait for script to load
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });

            // Check if FFmpeg is available
            if (typeof createFFmpeg === 'undefined') {
                throw new Error('FFmpeg failed to load - createFFmpeg not found');
            }

            console.log('FFmpeg script loaded, initializing...');

            // Create FFmpeg instance with local-friendly configuration
            this.ffmpeg = createFFmpeg({
                log: true,
                // Use jsdelivr for core files (better CORS support)
                corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
                // Disable workers to avoid CORS issues
                mainName: 'main',
            });

            // Set up progress tracking
            this.ffmpeg.setProgress(({ ratio }) => {
                if (ratio > 0 && ratio <= 1) {
                    const progress = Math.round(ratio * 100);
                    this.showProgress(progress);
                }
            });

            // Load FFmpeg core
            console.log('Loading FFmpeg core...');
            await this.ffmpeg.load();
            
            this.isLoaded = true;
            console.log('✅ FFmpeg loaded successfully!');
            
            // Show success message
            this.showSuccessMessage('FFmpeg loaded and ready to use!');

        } catch (error) {
            console.error('❌ Error loading FFmpeg:', error);
            this.handleFFmpegLoadError(error);
        }
    }

    handleFFmpegLoadError(error) {
        let errorMessage = 'Failed to load FFmpeg. ';
        let solutions = [];

        if (error.message.includes('Worker') || error.message.includes('CORS')) {
            errorMessage += 'This appears to be a CORS/Worker issue.';
            solutions = [
                '🌐 Upload files to a web server (GitHub Pages, Netlify, etc.)',
                '🖥️ Run a local server (see instructions below)',
                '🔄 Try a different browser (Chrome/Firefox work best)',
                '🔒 Disable browser security temporarily (not recommended)'
            ];
        } else if (error.message.includes('fetch')) {
            errorMessage += 'Network connection issue.';
            solutions = [
                '📡 Check your internet connection',
                '🔄 Refresh the page and try again',
                '🚫 Disable ad blockers temporarily',
                '🔥 Try disabling browser extensions'
            ];
        } else {
            errorMessage += error.message;
            solutions = [
                '🔄 Refresh the page',
                '🌐 Try a different browser',
                '📡 Check your internet connection'
            ];
        }

        this.showError(errorMessage, solutions);
        this.showLocalServerInstructions();
    }

    showLocalServerInstructions() {
        const instructionsDiv = document.createElement('div');
        instructionsDiv.className = 'server-instructions';
        instructionsDiv.style.cssText = `
            background: linear-gradient(135deg, #4834d4, #686de0);
            color: white;
            padding: 25px;
            border-radius: 12px;
            margin: 20px 0;
            box-shadow: 0 10px 25px rgba(72, 52, 212, 0.3);
            line-height: 1.6;
        `;
        
        instructionsDiv.innerHTML = `
            <h4 style="margin-bottom: 15px; color: #fff;">🖥️ How to Run Local Server:</h4>
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; margin: 10px 0;">
                <strong>Python:</strong><br>
                <code style="color: #fffa65;">python -m http.server 8000</code><br>
                Then open: <code style="color: #fffa65;">http://localhost:8000</code>
            </div>
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; margin: 10px 0;">
                <strong>Node.js:</strong><br>
                <code style="color: #fffa65;">npx serve .</code><br>
                Or: <code style="color: #fffa65;">npx http-server</code>
            </div>
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; margin: 10px 0;">
                <strong>PHP:</strong><br>
                <code style="color: #fffa65;">php -S localhost:8000</code>
            </div>
        `;
        
        this.conversionOptions.appendChild(instructionsDiv);
    }

    showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            background: linear-gradient(135deg, #00b894, #00cec9);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            margin: 15px 0;
            box-shadow: 0 5px 15px rgba(0, 184, 148, 0.3);
            font-weight: 500;
            text-align: center;
        `;
        successDiv.textContent = message;
        
        this.conversionOptions.insertBefore(successDiv, this.conversionOptions.firstChild);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
    }

    attachEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.convertBtn.addEventListener('click', () => this.convertFile());
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.currentFile = file;
            this.conversionOptions.style.display = 'block';
            console.log('📁 File selected:', file.name, file.type, `${(file.size / 1024 / 1024).toFixed(2)}MB`);
        }
    }

    async convertFile() {
        if (!this.isLoaded) {
            this.showError('⏳ FFmpeg is still loading or failed to load. Please wait or refresh the page.');
            return;
        }

        if (!this.currentFile) {
            this.showError('📁 Please select a file first.');
            return;
        }

        try {
            this.showProgress(0);
            this.setConvertButtonLoading(true);
            this.outputSection.style.display = 'none';

            // Get conversion parameters
            const format = document.querySelector('input[name="format"]:checked').value;
            const quality = document.getElementById('quality').value;

            // Prepare file names
            const inputFileName = `input.${this.getFileExtension(this.currentFile.name)}`;
            const outputFileName = `output.${format}`;

            console.log(`🔄 Converting ${inputFileName} to ${outputFileName} (${quality} quality)`);

            // Load file into FFmpeg filesystem
            console.log('📥 Loading file into FFmpeg...');
            this.ffmpeg.FS('writeFile', inputFileName, await fetchFile(this.currentFile));
            this.showProgress(20);

            // Build and execute FFmpeg command
            const command = this.buildFFmpegCommand(inputFileName, outputFileName, format, quality);
            console.log('⚡ FFmpeg command:', command);

            await this.ffmpeg.run(...command);
            this.showProgress(80);

            // Read the output file
            console.log('📤 Reading converted file...');
            const data = this.ffmpeg.FS('readFile', outputFileName);
            this.showProgress(90);

            // Create download link
            const blob = new Blob([data.buffer], { 
                type: this.getMimeType(format) 
            });
            const url = URL.createObjectURL(blob);

            this.downloadLink.href = url;
            this.downloadLink.download = `converted_${Date.now()}.${format}`;
            this.downloadLink.style.display = 'inline-flex';
            
            this.outputSection.style.display = 'block';
            this.showProgress(100);
            
            // Clean up FFmpeg filesystem
            try {
                this.ffmpeg.FS('unlink', inputFileName);
                this.ffmpeg.FS('unlink', outputFileName);
            } catch (cleanupError) {
                console.warn('🧹 Cleanup warning:', cleanupError);
            }

            console.log('✅ Conversion completed successfully!');

        } catch (error) {
            console.error('❌ Conversion error:', error);
            this.showError(`Conversion failed: ${error.message}`, [
                '🔄 Try a different file format',
                '📏 Check if file size is reasonable (under 100MB)',
                '🎥 Ensure the input file is valid',
                '🔄 Refresh and try again'
            ]);
        } finally {
            this.setConvertButtonLoading(false);
        }
    }

    buildFFmpegCommand(input, output, format, quality) {
        const command = ['-i', input];

        switch (format) {
            case 'mp4':
                command.push('-c:v', 'libx264', '-c:a', 'aac');
                switch (quality) {
                    case 'high': command.push('-crf', '18'); break;
                    case 'medium': command.push('-crf', '23'); break;
                    case 'low': command.push('-crf', '28'); break;
                }
                break;

            case 'webm':
                command.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus');
                switch (quality) {
                    case 'high': command.push('-crf', '30'); break;
                    case 'medium': command.push('-crf', '35'); break;
                    case 'low': command.push('-crf', '40'); break;
                }
                break;

            case 'mp3':
                command.push('-vn', '-c:a', 'libmp3lame');
                switch (quality) {
                    case 'high': command.push('-b:a', '320k'); break;
                    case 'medium': command.push('-b:a', '192k'); break;
                    case 'low': command.push('-b:a', '128k'); break;
                }
                break;

            case 'wav':
                command.push('-vn', '-c:a', 'pcm_s16le');
                break;
        }

        command.push(output);
        return command;
    }

    getFileExtension(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : 'mp4';
    }

    getMimeType(format) {
        const mimeTypes = {
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav'
        };
        return mimeTypes[format] || 'application/octet-stream';
    }

    showProgress(percentage) {
        this.progressSection.style.display = 'block';
        this.progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        this.progressText.textContent = `${Math.round(percentage)}%`;
    }

    setConvertButtonLoading(loading) {
        const btnText = this.convertBtn.querySelector('.btn-text');
        const btnLoader = this.convertBtn.querySelector('.btn-loader');
        
        if (loading) {
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline';
            this.convertBtn.disabled = true;
        } else {
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
            this.convertBtn.disabled = false;
        }
    }

    showError(message, solutions = []) {
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            box-shadow: 0 10px 25px rgba(255, 107, 107, 0.3);
            line-height: 1.6;
        `;
        
        let content = `<strong>❌ ${message}</strong>`;
        if (solutions.length > 0) {
            content += '<br><br><strong>Possible solutions:</strong><br>';
            content += solutions.map(solution => `• ${solution}`).join('<br>');
        }
        
        errorDiv.innerHTML = content;
        this.conversionOptions.appendChild(errorDiv);
        
        this.setConvertButtonLoading(false);
    }
}

// Initialize the converter when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 Media Converter initializing...');
    new MediaConverter();
});

// Add global error handlers
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});