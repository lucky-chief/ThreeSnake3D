import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'stats.js';

class SnakeGame {
    constructor() {
        // 游戏配置
        this.GRID_SIZE = 10;
        this.BOARD_SIZE = 30;
        this.GAME_SPEED = 50; // 毫秒
        this.TURN_SPEED = 0.16; // 增加转弯速度让移动更平滑
        this.SMOOTH_FACTOR = 0.6; // 平滑移动因子
        
        // 游戏状态
        this.gameState = 'waiting'; // 'waiting', 'playing', 'paused', 'gameOver'
        this.score = 0;
        
        // 蛇的运动状态
        this.snake = [
            { 
                x: 15, 
                y: 15, 
                actualX: 15 * this.GRID_SIZE, 
                actualY: 15 * this.GRID_SIZE,
                targetX: 15 * this.GRID_SIZE,
                targetY: 15 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 14, 
                y: 15, 
                actualX: 14 * this.GRID_SIZE, 
                actualY: 14 * this.GRID_SIZE,
                targetX: 14 * this.GRID_SIZE,
                targetY: 14 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 13, 
                y: 15, 
                actualX: 13 * this.GRID_SIZE, 
                actualY: 13 * this.GRID_SIZE,
                targetX: 13 * this.GRID_SIZE,
                targetY: 13 * this.GRID_SIZE,
                rotation: 0 
            }
        ];
        
        // 目标方向和当前方向
        this.targetDirection = 0; // 弧度
        this.currentDirection = 0; // 弧度
        this.moveSpeed = 10.5; // 稍微增加移动速度
        
        // 食物位置
        this.food = { x: 20, y: 20 };
        
        // 鼠标位置
        this.mouse = new THREE.Vector2();
        this.targetPosition = new THREE.Vector3();
        
        // Three.js 相关
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.snakeMeshes = [];
        this.foodMesh = null;
        this.boardMesh = null;
        
        // 性能监视器
        this.stats = null;
        
        // UI 元素
        this.scoreElement = document.getElementById('score-value');
        this.statusElement = document.getElementById('game-status');
        
        this.init();
        this.setupEventListeners();
        this.animate();
    }
    
    init() {
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        
        // 创建相机 - 调高俯视视角
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // 初始相机位置
        this.camera.position.set(0, 80, 40);
        
        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        document.getElementById('game-canvas').appendChild(this.renderer.domElement);
        
        // 设置相机与蛇头的相对位置关系
        const headWorldPos = this.getSnakeHeadWorldPosition();
        this.cameraOffset = new THREE.Vector3(
            this.camera.position.x - headWorldPos.x,
            this.camera.position.y - headWorldPos.y,
            this.camera.position.z - headWorldPos.z
        );
        
        // 记录初始距离
        this.cameraDistance = this.cameraOffset.length();
        
        // 设置OrbitControls - 仅用于手动调整视角
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true; // 添加阻尼效果
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true; // 启用滚轮缩放
        this.controls.enableRotate = true; // 启用旋转
        this.controls.enablePan = false; // 禁用平移
        this.controls.minDistance = 20; // 最小距离
        this.controls.maxDistance = 200; // 最大距离
        this.controls.minPolarAngle = 0.4; // 最小极角
        this.controls.maxPolarAngle = Math.PI / 2; // 最大极角（防止翻转到底部）
        this.controls.autoRotate = false; // 禁用自动旋转
        
        // 设置初始目标
        this.controls.target.copy(headWorldPos);
        this.controls.update();
        
        // 记录相机的初始朝向
        this.initialCameraRotation = this.camera.rotation.clone();
        this.initialCameraQuaternion = this.camera.quaternion.clone();
        
        // 初始化性能监视器
        this.stats = new Stats();
        this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
        this.stats.dom.style.position = 'absolute';
        this.stats.dom.style.left = '10px';
        this.stats.dom.style.top = '100px';
        this.stats.dom.style.zIndex = '1000';
        document.body.appendChild(this.stats.dom);
        
        // 添加灯光
        this.setupLighting();
        
        // 创建游戏板
        this.createBoard();
        
        // 创建蛇
        this.createSnake();
        
        // 创建食物
        this.createFood();
    }
    
    getSnakeHeadWorldPosition() {
        const head = this.snake[0];
        return new THREE.Vector3(
            head.actualX - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            0,
            head.actualY - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
    }
    
    setupLighting() {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // 方向光 - 从上方照射
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 50, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        this.scene.add(directionalLight);
        
        // 点光源跟随蛇头
        this.snakeLight = new THREE.PointLight(0x00ff88, 0.8, 100);
        this.snakeLight.position.set(0, 10, 0);
        this.scene.add(this.snakeLight);
    }
    
    createBoard() {
        // 游戏板几何体
        const boardGeometry = new THREE.PlaneGeometry(
            this.BOARD_SIZE * this.GRID_SIZE, 
            this.BOARD_SIZE * this.GRID_SIZE
        );
        const boardMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2a2a3e,
            transparent: true,
            opacity: 0.8
        });
        
        this.boardMesh = new THREE.Mesh(boardGeometry, boardMaterial);
        this.boardMesh.rotation.x = -Math.PI / 2;
        this.boardMesh.receiveShadow = true;
        this.scene.add(this.boardMesh);
        
        // 创建网格线
        this.createGridLines();
    }
    
    createGridLines() {
        const material = new THREE.LineBasicMaterial({ color: 0x444466, transparent: true, opacity: 0.3 });
        
        // 垂直线
        for (let i = 0; i <= this.BOARD_SIZE; i++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    -(this.BOARD_SIZE * this.GRID_SIZE) / 2
                ),
                new THREE.Vector3(
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    (this.BOARD_SIZE * this.GRID_SIZE) / 2
                )
            ]);
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
        }
        
        // 水平线
        for (let i = 0; i <= this.BOARD_SIZE; i++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(
                    -(this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2
                ),
                new THREE.Vector3(
                    (this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2
                )
            ]);
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
        }
    }
    
    createSnake() {
        // 清除现有的蛇身体
        this.snakeMeshes.forEach(mesh => this.scene.remove(mesh));
        this.snakeMeshes = [];
        
        // 创建蛇的每个节段
        this.snake.forEach((segment, index) => {
            let geometry, material;
            
            if (index === 0) {
                // 蛇头 - 使用球体
                const headSize = this.GRID_SIZE * 0.4;
                geometry = new THREE.SphereGeometry(headSize, 16, 16);
                material = new THREE.MeshPhongMaterial({ 
                    color: 0x00ff88,
                    shininess: 100,
                    emissive: 0x003322
                });
            } else {
                // 蛇身 - 使用立方体，从头到尾慢慢变细
                const bodySize = this.GRID_SIZE * (0.35 - index * 0.02); // 逐渐变小
                const minSize = this.GRID_SIZE * 0.15; // 最小尺寸
                const actualSize = Math.max(bodySize, minSize);
                
                geometry = new THREE.BoxGeometry(actualSize, actualSize, actualSize);
                material = new THREE.MeshPhongMaterial({ 
                    color: 0x00cc66,
                    shininess: 80
                });
            }
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // 设置位置 - 使用平滑的actualX/Y位置
            mesh.position.set(
                segment.actualX - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
                this.GRID_SIZE / 2,
                segment.actualY - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
            );
            
            // 设置旋转 - 身体部分稍微旋转增加视觉效果
            if (index > 0) {
                mesh.rotation.x = Math.PI / 8;
                mesh.rotation.y = index * 0.1;
            }
            
            mesh.castShadow = true;
            
            this.snakeMeshes.push(mesh);
            this.scene.add(mesh);
        });
    }
    
    createFood() {
        if (this.foodMesh) {
            this.scene.remove(this.foodMesh);
        }
        
        const geometry = new THREE.SphereGeometry(this.GRID_SIZE * 0.3, 16, 16);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff4444,
            shininess: 100,
            emissive: 0x440000
        });
        
        this.foodMesh = new THREE.Mesh(geometry, material);
        this.foodMesh.position.set(
            this.food.x * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            this.GRID_SIZE / 2,
            this.food.y * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
        this.foodMesh.castShadow = true;
        
        this.scene.add(this.foodMesh);
    }
    
    generateFood() {
        let newFood;
        do {
            newFood = {
                x: Math.floor(Math.random() * this.BOARD_SIZE),
                y: Math.floor(Math.random() * this.BOARD_SIZE)
            };
        } while (this.snake.some(segment => 
            Math.floor(segment.actualX / this.GRID_SIZE) === newFood.x && 
            Math.floor(segment.actualY / this.GRID_SIZE) === newFood.y
        ));
        
        this.food = newFood;
        this.createFood();
    }
    
    setupEventListeners() {
        // 鼠标移动事件
        document.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            // 计算目标方向
            if (this.gameState === 'playing') {
                this.updateTargetDirection();
            }
        });
        
        // 键盘事件保留部分功能
        document.addEventListener('keydown', (event) => {
            this.handleKeyPress(event.key);
        });
        
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
    }
    
    updateTargetDirection() {
        // 将鼠标坐标转换为世界坐标
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.mouse, this.camera);
        
        // 与地面平面相交
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);
        
        // 计算从蛇头到鼠标位置的方向
        const head = this.snake[0];
        const headWorldPos = new THREE.Vector3(
            head.actualX - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            0,
            head.actualY - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
        
        const direction = intersection.sub(headWorldPos);
        this.targetDirection = Math.atan2(direction.z, direction.x);
    }
    
    handleKeyPress(key) {
        switch (key.toLowerCase()) {
            case ' ':
                this.toggleGame();
                break;
            case 'r':
                this.resetGame();
                break;
        }
    }
    
    toggleGame() {
        if (this.gameState === 'waiting' || this.gameState === 'paused') {
            this.startGame();
        } else if (this.gameState === 'playing') {
            this.pauseGame();
        } else if (this.gameState === 'gameOver') {
            this.resetGame();
        }
    }
    
    startGame() {
        if (this.gameState === 'waiting') {
            this.gameState = 'playing';
            this.statusElement.textContent = '游戏进行中 - 鼠标控制蛇的移动';
            this.statusElement.className = '';
            this.gameLoop();
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.statusElement.textContent = '游戏进行中 - 鼠标控制蛇的移动';
            this.statusElement.className = '';
            this.gameLoop();
        }
    }
    
    pauseGame() {
        this.gameState = 'paused';
        this.statusElement.textContent = '游戏已暂停';
        this.statusElement.className = 'game-paused';
    }
    
    resetGame() {
        this.gameState = 'waiting';
        this.score = 0;
        this.currentDirection = 0;
        this.targetDirection = 0;
        
        this.snake = [
            { 
                x: 15, 
                y: 15, 
                actualX: 15 * this.GRID_SIZE, 
                actualY: 15 * this.GRID_SIZE,
                targetX: 15 * this.GRID_SIZE,
                targetY: 15 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 14, 
                y: 15, 
                actualX: 14 * this.GRID_SIZE, 
                actualY: 14 * this.GRID_SIZE,
                targetX: 14 * this.GRID_SIZE,
                targetY: 14 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 13, 
                y: 15, 
                actualX: 13 * this.GRID_SIZE, 
                actualY: 13 * this.GRID_SIZE,
                targetX: 13 * this.GRID_SIZE,
                targetY: 13 * this.GRID_SIZE,
                rotation: 0 
            }
        ];
        this.food = { x: 20, y: 20 };
        
        this.updateScore();
        this.statusElement.textContent = '按空格键开始游戏';
        this.statusElement.className = '';
        
        this.createSnake();
        this.createFood();
        
        // 重置相机控制目标和相对位置
        const headWorldPos = this.getSnakeHeadWorldPosition();
        this.controls.target.copy(headWorldPos);
        
        // 重新计算相机偏移量和距离
        this.cameraOffset = new THREE.Vector3(
            this.camera.position.x - headWorldPos.x,
            this.camera.position.y - headWorldPos.y,
            this.camera.position.z - headWorldPos.z
        );
        this.cameraDistance = this.cameraOffset.length();
        
        // 重新记录相机朝向
        this.initialCameraRotation = this.camera.rotation.clone();
        this.initialCameraQuaternion = this.camera.quaternion.clone();
    }
    
    gameLoop() {
        if (this.gameState !== 'playing') return;
        
        this.update();

        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    update() {
        // 圆滑转弯 - 插值当前方向到目标方向
        let angleDiff = this.targetDirection - this.currentDirection;
        
        // 处理角度环绕
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        this.currentDirection += angleDiff * this.TURN_SPEED;
        
        // 移动蛇头 - 使用目标位置实现平滑移动
        const head = this.snake[0];
        head.targetX += Math.cos(this.currentDirection) * this.moveSpeed * 0.02;
        head.targetY += Math.sin(this.currentDirection) * this.moveSpeed * 0.02;
        head.rotation = this.currentDirection;
        
        // 平滑插值到目标位置
        head.actualX += (head.targetX - head.actualX) * this.SMOOTH_FACTOR;
        head.actualY += (head.targetY - head.actualY) * this.SMOOTH_FACTOR;
        
        // 更新网格位置
        head.x = Math.floor(head.actualX / this.GRID_SIZE);
        head.y = Math.floor(head.actualY / this.GRID_SIZE);
        
        // 检查边界碰撞
        if (head.x < 0 || head.x >= this.BOARD_SIZE || 
            head.y < 0 || head.y >= this.BOARD_SIZE) {
            this.gameOver();
            return;
        }
        
        // 检查自身碰撞（跳过第一个和最后一个段以避免误判）
        for (let i = 3; i < this.snake.length; i++) {
            const segment = this.snake[i];
            const distance = Math.sqrt(
                Math.pow(head.actualX - segment.actualX, 2) + 
                Math.pow(head.actualY - segment.actualY, 2)
            );
            if (distance < this.GRID_SIZE * 0.8) {
                this.gameOver();
                return;
            }
        }
        
        // 修复食物碰撞检测 - 检查蛇头是否碰到食物
        if (head.x === this.food.x && head.y === this.food.y) {
            // 增加分数
            this.score += 10;
            this.updateScore();
            
            // 增加蛇的长度 - 复制蛇尾并添加到末尾
            const tail = this.snake[this.snake.length - 1];
            const newSegment = {
                x: tail.x,
                y: tail.y,
                actualX: tail.actualX,
                actualY: tail.actualY,
                targetX: tail.actualX,
                targetY: tail.actualY,
                rotation: tail.rotation
            };
            this.snake.push(newSegment);
            
            // 生成新食物
            this.generateFood();
            
            // 增加游戏速度
            if (this.GAME_SPEED > 100) {
                this.GAME_SPEED -= 2;
            }
            
            console.log('食物被吃掉，蛇长度：', this.snake.length, '分数：', this.score);
        }
        
        // 更新蛇身跟随 - 平滑跟随
        for (let i = 1; i < this.snake.length; i++) {
            const current = this.snake[i];
            const target = this.snake[i - 1];
            
            const dx = target.actualX - current.actualX;
            const dy = target.actualY - current.actualY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > this.GRID_SIZE) {
                const ratio = (distance - this.GRID_SIZE) / distance * 0.8; // 减少跟随速度
                current.targetX = current.actualX + dx * ratio;
                current.targetY = current.actualY + dy * ratio;
            }
            
            // 平滑插值到目标位置
            current.actualX += (current.targetX - current.actualX) * this.SMOOTH_FACTOR;
            current.actualY += (current.targetY - current.actualY) * this.SMOOTH_FACTOR;
            current.x = Math.floor(current.actualX / this.GRID_SIZE);
            current.y = Math.floor(current.actualY / this.GRID_SIZE);
        }
        
        // 更新蛇的3D模型
        this.createSnake();
        
        // 在所有物体位置更新完成后，再更新相机位置
        this.updateOrbitTarget();
    }
    
    updateOrbitTarget() {
        const headWorldPos = this.getSnakeHeadWorldPosition();
        const head = this.snake[0];
        
        // 检测用户是否正在操作相机
        // OrbitControls的state: NONE=-1, ROTATE=0, DOLLY=1, PAN=2
        const isUserInteracting = this.controls.enabled && 
            (this.controls.state !== -1); // -1是NONE状态，表示没有交互
        
        if (!isUserInteracting) {
            // 相机跟随逻辑：保持固定方向，只跟随位置移动
            
            // 1. 使用固定的相机偏移向量（不跟随蛇头旋转）
            const fixedOffset = this.cameraOffset.clone();
            
            // 2. 确保距离保持不变
            fixedOffset.normalize().multiplyScalar(this.cameraDistance);
            
            // 3. 计算新的相机位置
            const newCameraPos = headWorldPos.clone().add(fixedOffset);
            
            // 4. 平滑移动相机到新位置
            this.camera.position.lerp(newCameraPos, 0.1);
            
            // 5. 保持相机的初始朝向（不朝向蛇头）
            this.camera.quaternion.copy(this.initialCameraQuaternion);
            
            // 6. 更新OrbitControls的目标（但不强制朝向）
            this.controls.target.copy(headWorldPos);
            
            // 7. 保持up向量稳定
            this.camera.up.set(0, 1, 0);
        } else {
            // 用户正在操作时，只更新目标位置，让用户自由控制
            this.controls.target.copy(headWorldPos);
        }
        
        // 更新点光源位置
        this.snakeLight.position.copy(headWorldPos);
        this.snakeLight.position.y = 10;
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        this.statusElement.textContent = `游戏结束！得分: ${this.score}`;
        this.statusElement.className = 'game-over';
    }
    
    updateScore() {
        this.scoreElement.textContent = this.score;
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 更新性能监视器
        this.stats.begin();
        
        // 更新轨道控制
        this.controls.update();
        
        // 添加食物旋转动画
        if (this.foodMesh) {
            this.foodMesh.rotation.y += 0.02;
            this.foodMesh.position.y = this.GRID_SIZE / 2 + Math.sin(Date.now() * 0.005) * 3;
        }
        
        this.renderer.render(this.scene, this.camera);
        
        // 结束性能监视器计时
        this.stats.end();
    }
}

// 初始化游戏
new SnakeGame(); 