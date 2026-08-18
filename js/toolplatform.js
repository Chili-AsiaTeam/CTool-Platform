const canvas = document.getElementById('fluid-canvas');
        const ctx = canvas.getContext('2d');

        let width = 0;
        let height = 0;
        let time = 0;

        // Mouse displacement tracking
        const mouse = {
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0
        };

        // Organic Wave Blob definition
        class WaveBlob {
            constructor(options) {
                this.xRatio = options.xRatio;
                this.yRatio = options.yRatio;
                this.baseRadius = options.baseRadius;
                this.color = options.color;
                this.pointsCount = options.pointsCount || 8;
                this.speedOffset = options.speedOffset || 1;
                this.phase = Math.random() * Math.PI * 2;
            }

            draw(time) {
                const centerX = width * this.xRatio + (mouse.x - width / 2) * 0.08;
                const centerY = height * this.yRatio + (mouse.y - height / 2) * 0.08;
                const radius = Math.min(width, height) * this.baseRadius;

                ctx.save();
                ctx.beginPath();

                const points = [];
                for (let i = 0; i < this.pointsCount; i++) {
                    const angle = (i / this.pointsCount) * Math.PI * 2;
                    // Multi-frequency smooth sine wave equations
                    const wave1 = Math.sin(angle * 2 + time * this.speedOffset + this.phase) * 35*12;
                    const wave2 = Math.cos(angle * 3 - time * 0.7 * this.speedOffset) * 20*12;
                    const wave3 = Math.sin(time * 0.5 + i) * 15;
                    
                    const r = radius + wave1 + wave2 + wave3;
                    const px = centerX + Math.cos(angle) * r;
                    const py = centerY + Math.sin(angle) * r;
                    points.push({ x: px, y: py });
                }

                // Smooth Spline Curve connecting wave vertices
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 0; i < points.length; i++) {
                    const p0 = points[i];
                    const p1 = points[(i + 1) % points.length];
                    const midX = (p0.x + p1.x) / 2;
                    const midY = (p0.y + p1.y) / 2;
                    ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
                }
                ctx.closePath();

                // Radial gradient fill for smooth fluid wave depth
                const grad = ctx.createRadialGradient(
                    centerX, centerY, radius * 0.1,
                    centerX, centerY, radius * 1.3
                );
                grad.addColorStop(0, this.color.start);
                grad.addColorStop(0.6, this.color.mid);
                grad.addColorStop(1, 'rgba(242, 245, 250, 0)');

                ctx.fillStyle = grad;
                ctx.fill();
                ctx.restore();
            }
        }

        // DeepSeek Light Theme Wave Colors (Slate Blue, Ice Azure, Soft Indigo, Off-white)
        const blobs = [
            // Top Left Slate-Blue Wave
            new WaveBlob({
                xRatio: 0.25,
                yRatio: 0.3,
                baseRadius: 0.38,
                speedOffset: 0.9,
                color: {
                    start: 'rgba(100, 145, 220, 0.55)',
                    mid: 'rgba(145, 180, 240, 0.35)'
                }
            }),
            // Center Floating Ice Azure Wave
            new WaveBlob({
                xRatio: 0.55,
                yRatio: 0.45,
                baseRadius: 0.42,
                speedOffset: 0.7,
                color: {
                    start: 'rgba(160, 195, 255, 0.65)',
                    mid: 'rgba(195, 220, 255, 0.3)'
                }
            }),
            // Bottom Right Darker Cobalt Accent Wave
            new WaveBlob({
                xRatio: 0.8,
                yRatio: 0.7,
                baseRadius: 0.35,
                speedOffset: 1.1,
                color: {
                    start: 'rgba(70, 120, 205, 0.45)',
                    mid: 'rgba(120, 160, 230, 0.25)'
                }
            }),
            // Bottom Left Soft Purple-Blue Blend
            new WaveBlob({
                xRatio: 0.2,
                yRatio: 0.75,
                baseRadius: 0.32,
                speedOffset: 0.8,
                color: {
                    start: 'rgba(150, 160, 235, 0.4)',
                    mid: 'rgba(190, 200, 250, 0.2)'
                }
            }),
            // Center Highlight Cloud Wave
            new WaveBlob({
                xRatio: 0.45,
                yRatio: 0.2,
                baseRadius: 0.28,
                speedOffset: 1.2,
                color: {
                    start: 'rgba(255, 255, 255, 0.85)',
                    mid: 'rgba(215, 232, 255, 0.35)'
                }
            })
        ];

        function resize() {
            width = canvas.width = window.innerWidth * 1.2;
            height = canvas.height = window.innerHeight * 1.2;
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);

            // Interpolate Mouse Position
            mouse.x += (mouse.targetX - mouse.x) * 0.05;
            mouse.y += (mouse.targetY - mouse.y) * 0.05;

            // time += 0.008;
			time += 0.008;

            // Draw fluid wave blobs
            for (let blob of blobs) {
                blob.draw(time);
            }

            requestAnimationFrame(animate);
        }

        // Window Listeners
        window.addEventListener('resize', resize);
        
        window.addEventListener('mousemove', (e) => {
            mouse.targetX = e.clientX;
            mouse.targetY = e.clientY;
        });

        // Initialize
        resize();
        animate();
